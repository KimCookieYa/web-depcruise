import * as vscode from 'vscode';
import { generateGraph } from './generateGraphCommand';

/**
 * 프로젝트 전체 의존성 그래프를 생성하여 웹뷰로 표시합니다.
 */
export async function showEntireGraph(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('워크스페이스 루트를 찾을 수 없습니다.');
        return;
    }
    const config = vscode.workspace.getConfiguration('webDepcruiser');
    const format = config.get<'mmd' | 'svg' | 'png'>('defaultFormat', 'mmd')!;
    try {
        await generateGraph(workspaceRoot, 'deps', format);
    } catch (err: any) {
        vscode.window.showErrorMessage(`전체 그래프 생성 오류: ${err.message}`);
    }
} 