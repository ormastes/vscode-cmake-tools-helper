import * as vscode from 'vscode';
import * as fs from 'fs';

async function onProjectLoaded(context: vscode.ExtensionContext, project: any) {
    const storedConfigPreset = context.globalState.get<string>('activeConfigPreset');

    if (storedConfigPreset) {
        await project.setConfigurePreset(storedConfigPreset);
    }

    if (project.onActiveConfigurePresetChanged) {
        const configPresetChangedDisposable = project.onActiveConfigurePresetChanged(async (presetName: string | null) => {
            await context.globalState.update('activeConfigPreset', presetName);

            if (presetName) {
                await updateBuildPreset(project, presetName);
            }
        });

        context.subscriptions.push(configPresetChangedDisposable);
    } else {
        vscode.window.showErrorMessage('onActiveConfigurePresetChanged event is not supported in this version of CMake Tools.');
    }
}

async function syncConfigPreset(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	let cmakeHandle = await cmakeToolsExtension.activate();
	let cmakeApi = await cmakeHandle.getApi();
	let cmakeManger = cmakeApi.manager;
	const cmakeProject = cmakeManger.getActiveProject();
	let presetsController = cmakeProject.presetsController;
	const currentConfigPreset = cmakeProject.configurePreset;
	const currentConfigPresetName = currentConfigPreset ? currentConfigPreset.name : null;
	const storedConfigPreset = context.globalState.get<string>('activeConfigPreset');
	const allPresets: any[] = await presetsController.getAllConfigurePresets();
	
	// case allPresets is empty: register onActivePackagePresetChanged 
	if (allPresets.length === 0) {
		return;
	}

	if (storedConfigPreset === currentConfigPresetName) {
		return;
	}

	if (storedConfigPreset && allPresets.some(preset => preset.name === storedConfigPreset)) {
		// case storedConfigPreset in allPresets: use storedConfigPreset 
		//// case and currentConfigPreset not exist : does care
		//// case and currentConfigPreset exist : does care
		await cmakeProject.setConfigurePreset(storedConfigPreset);
	} else {
		// case storedConfigPreset not exist or storedConfigPreset not in allPresets
		if (currentConfigPreset) {
			//// case and currentConfigPreset not exist : use first preset and update storedConfigPreset
			context.globalState.update('activeConfigPreset', currentConfigPresetName);
		} else if (allPresets.length > 0) {
			//// case and currentConfigPreset exist : update storedConfigPreset with currentConfigPreset
			await cmakeProject.setConfigurePreset(allPresets[0].name);
			context.globalState.update('activeConfigPreset', allPresets[0].name);
		}
	}
}
// onBeforeAddFolder => onActiveProjectChanged => onActivePackagePresetChanged

async function registerOnBeforeAddFolder(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManger = cmakeApi.manager;
	const onBeforeAddFolder = cmakeManger.onBeforeAddFolder((folderProjectMap: any) => {
		registerOnActiveProjectChanged(context, cmakeToolsExtension);
	});
	context.subscriptions.push(onBeforeAddFolder);
}
async function registerOnActiveProjectChanged(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManger = cmakeApi.manager;
	const onBeforeAddFolder = cmakeManger.OnActiveProjectChanged((folderProjectMap: any) => {
		registerOnActivePackagePresetChanged(context, cmakeToolsExtension);
	});
	context.subscriptions.push(onBeforeAddFolder);
}
async function registerOnActivePackagePresetChanged(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManger = cmakeApi.manager;
	const cmakeProject = cmakeManger.getActiveProject();
	const onActivePackagePresetChanged = cmakeProject.onSelectedConfigurationChangedApiEvent(async (configType: any) => {
		const apiHandle = await cmakeToolsExtension.activate();
		const cmakeApi = await apiHandle.getApi();
		const cmakeManger = cmakeApi.manager;
		const cmakeProject = cmakeManger.getActiveProject();
		const currentConfigPreset = cmakeProject.configurePreset;
		const currentConfigPresetName = currentConfigPreset ? currentConfigPreset.name : null;
		context.globalState.update('activeConfigPreset', currentConfigPresetName);
	});
	context.subscriptions.push(onActivePackagePresetChanged);
}


async function activateCMakeTools(context: vscode.ExtensionContext, is_initial_activation: boolean = false) {
    const cmakeToolsExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
    if (!cmakeToolsExtension) {
        vscode.window.showErrorMessage('CMake Tools extension is not installed.');
        return;
    }
	registerOnBeforeAddFolder(context, cmakeToolsExtension);
	registerOnActiveProjectChanged(context, cmakeToolsExtension);
	registerOnActivePackagePresetChanged(context, cmakeToolsExtension);

	syncConfigPreset(context, cmakeToolsExtension);
}

async function updateBuildPreset(cmakeProject: any, configPresetName: string) {
    const cmakePresetsPath = 'path/to/CMakePresets.json';
    let presetsJson;

    try {
        const presetsContent = fs.readFileSync(cmakePresetsPath, 'utf8');
        presetsJson = JSON.parse(presetsContent);
    } catch (error) {
        console.error('Error reading CMakePresets.json:', error);
        return;
    }

    const buildPresets = presetsJson.buildPresets;
    if (!buildPresets) {
        return;
    }

    const matchingBuildPreset = buildPresets.find((preset: any) => preset.configurePreset === configPresetName);

    if (matchingBuildPreset) {
        await cmakeProject.setBuildPreset(matchingBuildPreset.name);
    }
}

export function activate(context: vscode.ExtensionContext) {
    vscode.extensions.onDidChange(() => {
        const cmakeToolsExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
        if (cmakeToolsExtension && !cmakeToolsExtension.isActive) {
            activateCMakeTools(context);
        }
    });

    activateCMakeTools(context, true);
}
