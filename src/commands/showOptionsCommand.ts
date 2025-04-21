import * as vscode from 'vscode';
import { generateGraph } from './generateGraphCommand';

/**
 * QuickPick 또는 설정값으로 모드 및 포맷을 결정하여 그래프 생성을 요청합니다.
 */
export async function showOptions(filePath: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('webDepcruiser');
    const quickPickEnabled = config.get<boolean>('quickPick.enabled', true);

    // Dependency mode 결정
    let mode = config.get<string>('defaultMode', 'reaches')!;
    if (quickPickEnabled) {
        const modeItems: vscode.QuickPickItem[] = [
            { label: 'reaches', description: '이 파일에 의존하는 모듈 (영향을 미침)' },
            { label: 'deps',    description: '이 파일이 의존하는 모듈' }
        ];
        const selected = await vscode.window.showQuickPick(modeItems, {
            placeHolder: '의존성 모드를 선택하세요',
            canPickMany: false,
            ignoreFocusOut: true
        });
        if (!selected) {
            return; // 취소
        }
        mode = selected.label;
    }

    // Output format 결정
    let format = config.get<string>('defaultFormat', 'mmd')!;
    if (quickPickEnabled) {
        const typeItems: vscode.QuickPickItem[] = [
            { label: 'mmd', description: 'Mermaid 형식 (기본값)' },
            { label: 'svg', description: 'SVG 이미지' },
            { label: 'png', description: 'PNG 이미지' }
        ];
        const selected = await vscode.window.showQuickPick(typeItems, {
            placeHolder: '출력 형식을 선택하세요',
            canPickMany: false,
            ignoreFocusOut: true
        });
        if (!selected) {
            return; // 취소
        }
        format = selected.label;
    }

    // 그래프 생성 실행
    await generateGraph(filePath, mode, format);
} 