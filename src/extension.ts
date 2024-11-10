import * as vscode from 'vscode';
import { assert } from 'console';

async function syncConfigPreset(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	const cmakeHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await cmakeHandle.getApi();
	const cmakeManger = cmakeApi.manager;
	const cmakeProject = cmakeManger.getActiveProject();
	const presetsController = cmakeProject.presetsController;
	const currentConfigPreset = cmakeProject.configurePreset;
	const currentConfigPresetName = currentConfigPreset ? currentConfigPreset.name : null;
	const storedConfigPreset = context.globalState.get<string>('activeConfigPreset');
	const allPresets: any[] = await presetsController.getAllConfigurePresets();
	
	// case allPresets is empty: register onActivePackagePresetChanged 
	if (allPresets.length === 0) {
		return;
	}

	if (storedConfigPreset !== currentConfigPresetName) {

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

	let finalConfigPreset = context.globalState.get<string>('activeConfigPreset');
	if (finalConfigPreset) {
		syncBuildPreset(context, cmakeToolsExtension, cmakeProject, finalConfigPreset);
	} else {
		assert(false, 'activeConfigPreset is null');
	}
}

async function syncBuildPreset(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>, cmakeProject: any, currentConfigPresetName: string) {
	const presetsController = cmakeProject.presetsController;
	const currentBuildPreset = cmakeProject.buildPreset;
	const currentBuildPresetName = currentBuildPreset ? currentBuildPreset.name : null;
	const storedBuildPreset = context.globalState.get<string>('activeBuildPreset');
	const _allPresets: any[] = await presetsController.getAllBuildPresets();

	// case allPresets is empty: register onActivePackagePresetChanged 
	if (_allPresets.length === 0) {
		return;
	}

	if (storedBuildPreset === currentBuildPresetName) {
		return;
	}
	// Filtering out the presets that are not match configuration type
	const allPresets = _allPresets.filter(preset => {
		return preset.configurePreset === currentConfigPresetName;
	});
	// case allPresets is empty
	if (allPresets.length === 0) {
		return;
	}

	if (storedBuildPreset && allPresets.some(preset => preset.name === storedBuildPreset)) {
		// case storedConfigPreset in allPresets: use storedConfigPreset 
		//// case and currentConfigPreset not exist : does care
		//// case and currentConfigPreset exist : does care
		await cmakeProject.setBuildPreset(storedBuildPreset);
	} else {
		// case storedConfigPreset not exist or storedConfigPreset not in allPresets
		if (storedBuildPreset) {
			//// case and currentConfigPreset not exist : use first preset and update storedConfigPreset
			context.globalState.update('activeBuildPreset', currentBuildPresetName);
		} else if (allPresets.length > 0) {
			//// case and currentConfigPreset exist : update storedConfigPreset with currentConfigPreset
			await cmakeProject.setBuildPreset(allPresets[0].name);
			context.globalState.update('activeBuildPreset', allPresets[0].name);
		}
	}
}
// onBeforeAddFolder => onActiveProjectChanged => onActivePackagePresetChanged

async function registerOnBeforeAddFolder(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManger = cmakeApi.manager;
	const cmakeProject = cmakeManger.getActiveProject();
	const projectController = cmakeProject.projectController;
	const onBeforeAddFolder = projectController.onBeforeAddFolder(async (folderProjectMap: any) => {
		registerOnActiveProjectChanged(context, cmakeToolsExtension);
	});
	context.subscriptions.push(onBeforeAddFolder);
}
async function registerOnActiveProjectChanged(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();

	const onBeforeAddFolder = cmakeApi.onActiveProjectChanged( async (folderProjectMap: any) => {
		registerOnActiveConfigPresetChanged(context, cmakeToolsExtension);
	});
	context.subscriptions.push(onBeforeAddFolder);
}
async function registerOnActiveConfigPresetChanged(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManger = cmakeApi.manager;
	const cmakeProject = cmakeManger.getActiveProject();
	const onActivePackagePresetChanged = cmakeProject.onActiveConfigurePresetChanged(async (configType: any) => {
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
async function registerOnActiveBuildPresetChanged(context: vscode.ExtensionContext, cmakeToolsExtension: vscode.Extension<any>) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManger = cmakeApi.manager;
	const cmakeProject = cmakeManger.getActiveProject();
	const onActivePackagePresetChanged = cmakeProject.onActiveBuildPresetChanged(async (configType: any) => {
		const apiHandle = await cmakeToolsExtension.activate();
		const cmakeApi = await apiHandle.getApi();
		const cmakeManger = cmakeApi.manager;
		const cmakeProject = cmakeManger.getActiveProject();
		const currentBuildPreset = cmakeProject.buildPreset;
		const currentBuildPresetName = currentBuildPreset ? currentBuildPreset.name : null;
		context.globalState.update('activeBuildPreset', currentBuildPresetName);
	});
	context.subscriptions.push(onActivePackagePresetChanged);
}

async function activateCMakeTools(context: vscode.ExtensionContext, is_initial_activation: boolean = false) {
    const cmakeToolsExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
    if (!cmakeToolsExtension) {
        vscode.window.showErrorMessage('CMake Tools extension is not installed.');
        return;
    }
	if (!cmakeToolsExtension.isActive) {
        await cmakeToolsExtension.activate();
    }
	registerOnBeforeAddFolder(context, cmakeToolsExtension);
	registerOnActiveProjectChanged(context, cmakeToolsExtension);
	registerOnActiveConfigPresetChanged(context, cmakeToolsExtension);
	registerOnActiveBuildPresetChanged(context, cmakeToolsExtension);

	syncConfigPreset(context, cmakeToolsExtension);
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
