import * as vscode from 'vscode';
import { FileExplorerProvider } from './providers/FileExplorerProvider';
import { showOptions } from './commands/showOptionsCommand';
import { showEntireGraph } from './commands/showEntireGraphCommand';
import { openSettings } from './commands/openSettingsCommand';
import { CommandProvider } from './providers/CommandProvider';

/**
 * 확장 기능이 활성화될 때 호출됩니다.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('web-depcruiser 확장 기능이 활성화되었습니다.');

    // 명령어 뷰 등록
    const commandProvider = new CommandProvider();
    vscode.window.registerTreeDataProvider('web-depcruiser.commands', commandProvider);

    // 파일 탐색기 뷰 등록
    const fileExplorerProvider = new FileExplorerProvider();
    vscode.window.registerTreeDataProvider('web-depcruiser.fileExplorer', fileExplorerProvider);

    // 파일 트리 새로고침 및 옵션 선택 명령 등록
    context.subscriptions.push(
        vscode.commands.registerCommand('web-depcruiser.refreshFileExplorer', () => fileExplorerProvider.refresh()),
        vscode.commands.registerCommand('web-depcruiser.showOptions', async (filePath: string) => {
            await showOptions(filePath);
        }),
        vscode.commands.registerCommand('web-depcruiser.showEntireGraph', showEntireGraph),
        vscode.commands.registerCommand('web-depcruiser.openSettings', openSettings)
    );
}

/**
 * 확장 기능이 비활성화될 때 호출됩니다.
 */
export function deactivate() {}