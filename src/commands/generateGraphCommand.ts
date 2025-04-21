import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DepcruiseService } from '../services/DepcruiseService';
import { GraphPreviewPanel } from '../webview/GraphPreviewPanel';

export async function generateGraph(filePath: string, mode: string, format: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('워크스페이스 루트를 찾을 수 없습니다.');
        return;
    }

    // 설정 파일 경로 결정
    const defaultConfigPath = path.join(workspaceRoot, '.option', 'dependency-cruiser.js');
    let configPath = defaultConfigPath;
    const customConfigCandidates = [
        path.join(workspaceRoot, '.dependency-cruiser.js'),
        path.join(workspaceRoot, '.dependency-cruiser.json'),
        path.join(workspaceRoot, 'dependency-cruiser.config.js'),
        path.join(workspaceRoot, 'dependency-cruiser.config.json'),
    ];
    for (const cfg of customConfigCandidates) {
        if (fs.existsSync(cfg)) {
            configPath = cfg;
            break;
        }
    }
    const configOption = `--config "${configPath}"`;

    // targetPath 결정 (reaches 모드 상대경로)
    let targetPath = filePath;
    if (mode === 'reaches') {
        targetPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    }

    // 사용자 설정 기반 옵션
    const config = vscode.workspace.getConfiguration('webDepcruiser');
    const includeNodeModules = config.get<boolean>('includeNodeModules', true);
    const collapsePattern = config.get<string>('collapsePattern', '^(node_modules|lib)/[^/]+');
    const nodeModulesOptions = includeNodeModules
        ? `--do-not-follow node_modules --collapse "${collapsePattern}"`
        : `--exclude "${collapsePattern}"`;

    try {
        const data = await DepcruiseService.run(
            workspaceRoot,
            configOption,
            targetPath,
            nodeModulesOptions,
            mode,
            format
        );
        GraphPreviewPanel.showData(data, format);
    } catch (err: any) {
        vscode.window.showErrorMessage(`그래프 생성 오류: ${err.message}`);
    }
} 