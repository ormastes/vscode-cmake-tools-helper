import * as vscode from 'vscode';
import * as fs from 'fs';

async function activateCMakeTools(context: vscode.ExtensionContext) {
    const cmakeToolsExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
    if (!cmakeToolsExtension) {
        vscode.window.showErrorMessage('CMake Tools extension is not installed.');
        return;
    }

    // Activate the extension and get its API
    const cmakeTools = await cmakeToolsExtension.activate();

    if (!cmakeTools || !cmakeTools.getActiveProject) {
        vscode.window.showErrorMessage('CMake Tools extension does not provide the expected API.');
        return;
    }

    // Get the active project
    const cmakeProject = cmakeTools.getActiveProject();

    if (!cmakeProject) {
        vscode.window.showErrorMessage('No active CMake project found.');
        return;
    }

    // Retrieve the stored configuration preset from persistent storage
    const storedConfigPreset = context.globalState.get<string>('activeConfigPreset');

    if (storedConfigPreset) {
        // Set the active configuration preset to the stored value
        await cmakeProject.setConfigurePreset(storedConfigPreset);
    }

    // Listen for changes in the active configuration preset
    const configPresetChangedDisposable = cmakeProject.onActiveConfigurePresetChanged(async (presetName: string| null) => {
        // Store the new active configuration preset in persistent storage
        await context.globalState.update('activeConfigPreset', presetName);

        // Ensure that when the active configuration preset changes, the corresponding build preset is activated if it matches
        if (presetName) {
            await updateBuildPreset(cmakeProject, presetName);
        }
    });

    context.subscriptions.push(configPresetChangedDisposable);
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

    // Find a build preset that matches the configuration preset
    const matchingBuildPreset = buildPresets.find((preset: any) => preset.configurePreset === configPresetName);

    if (matchingBuildPreset) {
        // Set the active build preset
        await cmakeProject.setBuildPreset(matchingBuildPreset.name);
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Listen for changes in the extensions
    vscode.extensions.onDidChange(() => {
        const cmakeToolsExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
        if (cmakeToolsExtension && !cmakeToolsExtension.isActive) {
            activateCMakeTools(context);
        }
    });

    // Initial activation check
    activateCMakeTools(context);
}