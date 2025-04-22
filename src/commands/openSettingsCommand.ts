import * as vscode from 'vscode';

/**
 * Web DepCruiser 확장 설정(UI)을 엽니다.
 */
export async function openSettings(): Promise<void> {
    // Web DepCruiser 설정 섹션을 검색하여 설정 UI를 엽니다.
    await vscode.commands.executeCommand('workbench.action.openSettings', 'webDepcruiser');
} 