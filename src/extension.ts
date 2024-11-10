import * as vscode from 'vscode';
import * as assert from 'assert';

/**
 * Synchronizes the configure preset between the extension's global state and the CMake Tools extension.
 * @param context The extension context.
 * @param cmakeToolsExtension The CMake Tools extension.
 */
async function syncConfigPreset(
	context: vscode.ExtensionContext,
	cmakeToolsExtension: vscode.Extension<any>
) {
	// Activate the CMake Tools extension and get its API
	const cmakeHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await cmakeHandle.getApi();
	const cmakeManager = cmakeApi.manager;
	const cmakeProject = cmakeManager.getActiveProject();

	if (!cmakeProject) {
		vscode.window.showErrorMessage('No active CMake project found.');
		return;
	}

	const presetsController = cmakeProject.presetsController;
	const currentConfigPreset = cmakeProject.configurePreset;
	const currentConfigPresetName = currentConfigPreset ? currentConfigPreset.name : null;
	const storedConfigPreset = context.globalState.get<string>('activeConfigPreset');
	const allPresets: any[] = await presetsController.getAllConfigurePresets();

	// If no configure presets are available, return
	if (allPresets.length === 0) {
		return;
	}

	if (storedConfigPreset !== currentConfigPresetName) {
		if (storedConfigPreset && allPresets.some(preset => preset.name === storedConfigPreset)) {
			// Use the stored preset if it exists in the available presets
			await cmakeProject.setConfigurePreset(storedConfigPreset);
		} else {
			if (currentConfigPresetName) {
				// Update stored preset with current preset
				context.globalState.update('activeConfigPreset', currentConfigPresetName);
			} else {
				// Set to the first available preset and update stored preset
				const firstPresetName = allPresets[0].name;
				await cmakeProject.setConfigurePreset(firstPresetName);
				context.globalState.update('activeConfigPreset', firstPresetName);
			}
		}
	}

	const finalConfigPreset = context.globalState.get<string>('activeConfigPreset');
	if (finalConfigPreset) {
		await syncBuildPreset(context, cmakeToolsExtension, cmakeProject, finalConfigPreset);
	} else {
		assert.ok(false, 'activeConfigPreset is null');
	}
}

/**
 * Synchronizes the build preset based on the active configure preset.
 * @param context The extension context.
 * @param cmakeToolsExtension The CMake Tools extension.
 * @param cmakeProject The active CMake project.
 * @param currentConfigPresetName The name of the current configure preset.
 */
async function syncBuildPreset(
	context: vscode.ExtensionContext,
	cmakeToolsExtension: vscode.Extension<any>,
	cmakeProject: any,
	currentConfigPresetName: string
) {
	const presetsController = cmakeProject.presetsController;
	const currentBuildPreset = cmakeProject.buildPreset;
	const currentBuildPresetName = currentBuildPreset ? currentBuildPreset.name : null;
	const storedBuildPreset = context.globalState.get<string>('activeBuildPreset');
	const allBuildPresets: any[] = await presetsController.getAllBuildPresets();

	// If no build presets are available, return
	if (allBuildPresets.length === 0) {
		return;
	}

	if (storedBuildPreset === currentBuildPresetName) {
		// Presets are already synchronized
		return;
	}

	// Filter build presets that match the current configure preset
	const matchingBuildPresets = allBuildPresets.filter(
		preset => preset.configurePreset === currentConfigPresetName
	);

	// If no matching build presets are found, return
	if (matchingBuildPresets.length === 0) {
		return;
	}

	if (storedBuildPreset && matchingBuildPresets.some(preset => preset.name === storedBuildPreset)) {
		// Use the stored build preset if it exists in the available presets
		await cmakeProject.setBuildPreset(storedBuildPreset);
	} else {
		if (currentBuildPresetName) {
			// Update stored build preset with current build preset
			context.globalState.update('activeBuildPreset', currentBuildPresetName);
		} else {
			// Set to the first available matching build preset and update stored preset
			const firstPresetName = matchingBuildPresets[0].name;
			await cmakeProject.setBuildPreset(firstPresetName);
			context.globalState.update('activeBuildPreset', firstPresetName);
		}
	}
}

/**
 * Registers an event handler for when a new folder is added.
 * @param context The extension context.
 * @param cmakeToolsExtension The CMake Tools extension.
 */
async function registerOnBeforeAddFolder(
	context: vscode.ExtensionContext,
	cmakeToolsExtension: vscode.Extension<any>
) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManager = cmakeApi.manager;
	const cmakeProject = cmakeManager.getActiveProject();
	const projectController = cmakeProject.projectController;

	const disposable = projectController.onBeforeAddFolder(async (folderProjectMap: any) => {
		await registerOnActiveProjectChanged(context, cmakeToolsExtension);
	});
	context.subscriptions.push(disposable);
}

/**
 * Registers an event handler for when the active CMake project changes.
 * @param context The extension context.
 * @param cmakeToolsExtension The CMake Tools extension.
 */
async function registerOnActiveProjectChanged(
	context: vscode.ExtensionContext,
	cmakeToolsExtension: vscode.Extension<any>
) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();

	const disposable = cmakeApi.onActiveProjectChanged(async (folderProjectMap: any) => {
		await registerOnActiveConfigPresetChanged(context, cmakeToolsExtension);
	});
	context.subscriptions.push(disposable);
}

/**
 * Registers an event handler for when the active configure preset changes.
 * @param context The extension context.
 * @param cmakeToolsExtension The CMake Tools extension.
 */
async function registerOnActiveConfigPresetChanged(
	context: vscode.ExtensionContext,
	cmakeToolsExtension: vscode.Extension<any>
) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManager = cmakeApi.manager;
	const cmakeProject = cmakeManager.getActiveProject();

	const disposable = cmakeProject.onActiveConfigurePresetChanged(async () => {
		const currentConfigPreset = cmakeProject.configurePreset;
		const currentConfigPresetName = currentConfigPreset ? currentConfigPreset.name : null;
		context.globalState.update('activeConfigPreset', currentConfigPresetName);
	});
	context.subscriptions.push(disposable);
}

/**
 * Registers an event handler for when the active build preset changes.
 * @param context The extension context.
 * @param cmakeToolsExtension The CMake Tools extension.
 */
async function registerOnActiveBuildPresetChanged(
	context: vscode.ExtensionContext,
	cmakeToolsExtension: vscode.Extension<any>
) {
	const apiHandle = await cmakeToolsExtension.activate();
	const cmakeApi = await apiHandle.getApi();
	const cmakeManager = cmakeApi.manager;
	const cmakeProject = cmakeManager.getActiveProject();

	const disposable = cmakeProject.onActiveBuildPresetChanged(async () => {
		const currentBuildPreset = cmakeProject.buildPreset;
		const currentBuildPresetName = currentBuildPreset ? currentBuildPreset.name : null;
		context.globalState.update('activeBuildPreset', currentBuildPresetName);
	});
	context.subscriptions.push(disposable);
}

/**
 * Activates the CMake Tools extension and registers necessary event handlers.
 * @param context The extension context.
 * @param isInitialActivation Whether this is the initial activation.
 */
async function activateCMakeTools(
	context: vscode.ExtensionContext,
	isInitialActivation: boolean = false
) {
	const cmakeToolsExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
	if (!cmakeToolsExtension) {
		vscode.window.showErrorMessage('CMake Tools extension is not installed.');
		return;
	}
	if (!cmakeToolsExtension.isActive) {
		await cmakeToolsExtension.activate();
	}

	await registerOnBeforeAddFolder(context, cmakeToolsExtension);
	await registerOnActiveProjectChanged(context, cmakeToolsExtension);
	await registerOnActiveConfigPresetChanged(context, cmakeToolsExtension);
	await registerOnActiveBuildPresetChanged(context, cmakeToolsExtension);

	await syncConfigPreset(context, cmakeToolsExtension);
}

/**
 * The activate function is called when the extension is activated.
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
	// Register the refresh command
    const refreshCommand = vscode.commands.registerCommand('vscode-cmake-tools-helper.refresh', () => {
        vscode.window.showInformationMessage('CMake Tools Helper: Refresh command executed');
        activateCMakeTools(context);
    });
	context.subscriptions.push(refreshCommand);
	
	// Listen for changes in extensions to detect when CMake Tools is activated
	vscode.extensions.onDidChange(() => {
		const cmakeToolsExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
		if (cmakeToolsExtension && !cmakeToolsExtension.isActive) {
			activateCMakeTools(context);
		}
	});

	activateCMakeTools(context, true);
}
