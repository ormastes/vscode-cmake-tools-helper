import * as assert from 'assert';
import * as vscode from 'vscode';



suite('vscode-cmake-tools-helper Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		assert.ok(extension, 'Extension not found');
	});

	test('Extension should activate', async () => {
		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		assert.ok(extension, 'Extension not found');
		await extension.activate();
		assert.ok(extension.isActive, 'Extension is not active');
	});

	test('CMake Tools Extension should be present', () => {
		const cmakeExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
		assert.ok(cmakeExtension, 'CMake Tools extension is not installed');
	});

	test('Extension activates CMake Tools Extension', async () => {
		const cmakeExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
		assert.ok(cmakeExtension, 'CMake Tools extension is not installed');

		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		assert.ok(extension, 'Extension not found');
		await extension.activate();
		assert.ok(extension.isActive, 'Extension failed to activate');

		await cmakeExtension.activate();
		assert.ok(cmakeExtension.isActive, 'CMake Tools extension failed to activate');
	});

	test('Synchronizes configure preset on activation', async () => {
		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		assert.ok(extension, 'Extension not found');
		await extension.activate();

		const context = { globalState: { get: () => undefined, update: () => { } } } as any;
		const activateFunction = extension.exports.activate;

		// Call the activate function to test synchronization
		try {
			await activateFunction(context);
			assert.ok(true, 'Synchronize configure preset executed successfully');
		} catch (error) {
			assert.fail('Synchronize configure preset failed: ' + error);
		}
	});

	test('Handles no configure presets gracefully', async () => {
		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		assert.ok(extension, 'Extension not found');
		await extension.activate();

		const cmakeExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
		assert.ok(cmakeExtension, 'CMake Tools extension is not installed');
		await cmakeExtension.activate();

		// Mock the CMake Project and Presets Controller to return no presets
		const cmakeApi = await cmakeExtension.exports.getApi();
		const cmakeManager = cmakeApi.manager;
		const cmakeProject = cmakeManager.getActiveProject();
		cmakeProject.presetsController.getAllConfigurePresets = async () => [];
		cmakeProject.presetsController.getAllBuildPresets = async () => [];

		const context = { globalState: { get: () => undefined, update: () => { } } } as any;
		const activateFunction = extension.exports.activate;

		// Call the activate function to test handling of no presets
		try {
			await activateFunction(context);
			assert.ok(true, 'No configure presets handled gracefully');
		} catch (error) {
			assert.fail('Handling of no configure presets failed: ' + error);
		}
	});

	test('Synchronizes build preset when configure preset changes', async () => {
		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		assert.ok(extension, 'Extension not found');
		await extension.activate();

		const cmakeExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
		assert.ok(cmakeExtension, 'CMake Tools extension is not installed');
		await cmakeExtension.activate();

		// Mock presets
		const cmakeApi = await cmakeExtension.exports.getApi();
		const cmakeManager = cmakeApi.manager;
		const cmakeProject = cmakeManager.getActiveProject();
		const presetsController = cmakeProject.presetsController;

		const configurePresetName = 'Debug';
		const buildPresetName = 'Debug Build';

		presetsController.getAllConfigurePresets = async () => [{ name: configurePresetName }];
		presetsController.getAllBuildPresets = async () => [{ name: buildPresetName, configurePreset: configurePresetName }];

		cmakeProject.configurePreset = { name: configurePresetName };
		cmakeProject.buildPreset = null;

		const context = {
			globalState: {
				get: () => undefined,
				update: () => { }
			}
		} as any;

		const activateFunction = extension.exports.activate;

		// Call the activate function to test synchronization
		try {
			await activateFunction(context);
			assert.ok(cmakeProject.buildPreset, 'Build preset was not set');
			assert.strictEqual(cmakeProject.buildPreset.name, buildPresetName, 'Build preset name mismatch');
		} catch (error) {
			assert.fail('Synchronization of build preset failed: ' + error);
		}
	});

	test('Updates globalState after changing presets', async () => {
		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		assert.ok(extension, 'Extension not found');
		await extension.activate();

		const context = {
			globalState: {
				data: {} as Record<string, any>,
				get(key: string) { return this.data[key]; },
				update(key: string, value: any) { this.data[key] = value; }
			}
		} as any;

		const cmakeExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
		assert.ok(cmakeExtension, 'CMake Tools extension is not installed');
		await cmakeExtension.activate();

		// Mock presets
		const cmakeApi = await cmakeExtension.exports.getApi();
		const cmakeManager = cmakeApi.manager;
		const cmakeProject = cmakeManager.getActiveProject();
		const presetsController = cmakeProject.presetsController;

		const configurePresetName = 'Release';
		const buildPresetName = 'Release Build';

		presetsController.getAllConfigurePresets = async () => [{ name: configurePresetName }];
		presetsController.getAllBuildPresets = async () => [{ name: buildPresetName, configurePreset: configurePresetName }];

		cmakeProject.configurePreset = { name: configurePresetName };
		cmakeProject.buildPreset = { name: buildPresetName };

		const activateFunction = extension.exports.activate;

		// Call the activate function to test globalState updates
		try {
			await activateFunction(context);
			assert.strictEqual(context.globalState.get('activeConfigPreset'), configurePresetName, 'activeConfigPreset not updated');
			assert.strictEqual(context.globalState.get('activeBuildPreset'), buildPresetName, 'activeBuildPreset not updated');
		} catch (error) {
			assert.fail('Updating globalState failed: ' + error);
		}
	});

	test('Refresh command executes', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('vscode-cmake-tools-helper.refresh'), 'Refresh command is not registered');

		let commandExecuted = false;
		const originalShowInformationMessage = vscode.window.showInformationMessage;
		vscode.window.showInformationMessage = (message: string) => {
			if (message.includes('Refresh command executed')) {
				commandExecuted = true;
			}
			return Promise.resolve();
		};

		await vscode.commands.executeCommand('vscode-cmake-tools-helper.refresh');
		assert.ok(commandExecuted, 'Refresh command did not execute');

		vscode.window.showInformationMessage = originalShowInformationMessage;
	});

	test('Registers event handlers on activation', async () => {
		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		const context = { subscriptions: [] } as vscode.ExtensionContext;
		assert.ok(extension, 'Extension not found');
		await extension.activate();
		const activateFunction = extension.exports.activate;

		// Call the activate function to test event handler registration
		try {
			await activateFunction(context);
			assert.ok(context.subscriptions.length > 0, 'No event handlers registered');
		} catch (error) {
			assert.fail('Registration of event handlers failed: ' + error);
		}
	});

	test('Handles addition of new folder', async () => {
		const extension = vscode.extensions.getExtension('your-name.vscode-cmake-tools-helper');
		assert.ok(extension, 'Extension not found');
		await extension.activate();

		const cmakeExtension = vscode.extensions.getExtension('ms-vscode.cmake-tools');
		assert.ok(cmakeExtension, 'CMake Tools extension is not installed');
		await cmakeExtension.activate();

		const cmakeApi = await cmakeExtension.exports.getApi();
		const projectController = cmakeApi.manager.getActiveProject().projectController;

		let eventHandlerRegistered = false;
		projectController.onBeforeAddFolder = (callback: any) => {
			eventHandlerRegistered = true;
			return { dispose: () => { } };
		};

		const context = { subscriptions: [] } as vscode.ExtensionContext;
		const activateFunction = extension.exports.activate;

		await activateFunction(context);
		assert.ok(eventHandlerRegistered, 'Event handler for onBeforeAddFolder not registered');
	});

	// Additional tests can be added here to cover more functionality.
});
