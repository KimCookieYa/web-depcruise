import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec, ExecException } from 'child_process';

/**
 * 확장 기능이 활성화될 때 호출됩니다.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('web-depcruiser 확장 기능이 활성화되었습니다.');

    // 파일 탐색기 뷰 등록
    const fileExplorerProvider = new FileExplorerProvider();
    vscode.window.registerTreeDataProvider('web-depcruiser.fileExplorer', fileExplorerProvider);

    // 파일 탐색기 새로고침 명령 등록
    context.subscriptions.push(
        vscode.commands.registerCommand('web-depcruiser.refreshFileExplorer', () => fileExplorerProvider.refresh())
    );

    // 의존성 그래프 옵션 선택 및 그래프 생성 명령 등록
    context.subscriptions.push(
        vscode.commands.registerCommand('web-depcruiser.showOptions', async (filePath: string) => {
            await showOptions(filePath);
        })
    );
}

/**
 * 확장 기능이 비활성화될 때 호출됩니다.
 */
export function deactivate() {}

/**
 * 파일 또는 폴더 노드를 나타내는 TreeItem
 */
class FileNode extends vscode.TreeItem {
    constructor(
        public readonly uri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(uri, collapsibleState);
        this.label = path.basename(uri.fsPath);
        if (this.collapsibleState === vscode.TreeItemCollapsibleState.None) {
            // 파일인 경우 의존성 그래프 생성 명령 실행
            this.command = {
                command: 'web-depcruiser.showOptions',
                title: '의존성 그래프 생성',
                arguments: [this.uri.fsPath]
            };
            this.contextValue = 'file';
        } else {
            this.contextValue = 'folder';
        }
    }
}

/**
 * 프로젝트 파일을 보여주는 TreeDataProvider
 */
class FileExplorerProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileNode | null> = new vscode.EventEmitter<FileNode | null>();
    readonly onDidChangeTreeData: vscode.Event<FileNode | null> = this._onDidChangeTreeData.event;

    /** 뷰 갱신 트리거 */
    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }

    getTreeItem(element: FileNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: FileNode): Promise<FileNode[]> {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showInformationMessage('워크스페이스가 열려 있지 않습니다.');
            return [];
        }
        const rootUri = vscode.workspace.workspaceFolders[0].uri;
        const dirUri = element ? element.uri : rootUri;
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        const nodes: FileNode[] = entries
            .filter(([name, type]) => {
                if (type === vscode.FileType.Directory) {
                    // node_modules 및 숨김 디렉토리 제외
                    return name !== 'node_modules' && !name.startsWith('.');
                }
                // 파일 확장자 필터 (.ts, .tsx, .js, .jsx, .vue)
                return ['.ts', '.tsx', '.js', '.jsx', '.vue'].some(ext => name.endsWith(ext));
            })
            .map(([name, type]) => {
                const uri = vscode.Uri.joinPath(dirUri, name);
                const state = type === vscode.FileType.Directory
                    ? vscode.TreeItemCollapsibleState.Collapsed
                    : vscode.TreeItemCollapsibleState.None;
                return new FileNode(uri, state);
            });
        return nodes;
    }
}

/**
 * QuickPick을 통해 모드 및 타입을 선택하고 그래프를 생성합니다.
 */
async function showOptions(filePath: string) {
    const config = vscode.workspace.getConfiguration('webDepcruiser');
    const quickPickEnabled = config.get<boolean>('quickPick.enabled', true);
    // 모드 결정
    let mode = config.get<string>('defaultMode', 'reaches')!;
    if (quickPickEnabled) {
        const modeItems: vscode.QuickPickItem[] = [
            { label: 'reaches', description: '이 파일에 의존하는 모듈 (영향을 미침)' },
            { label: 'deps', description: '이 파일이 의존하는 모듈' }
        ];
        const selectedMode = await vscode.window.showQuickPick(modeItems, {
            placeHolder: '의존성 모드를 선택하세요',
            canPickMany: false,
            ignoreFocusOut: true
        });
        if (!selectedMode) {
            return;
        }
        mode = selectedMode.label;
    }
    // 형식 결정
    let type = config.get<string>('defaultFormat', 'mmd')!;
    if (quickPickEnabled) {
        const typeItems: vscode.QuickPickItem[] = [
            { label: 'mmd', description: 'Mermaid 형식 (기본값)' },
            { label: 'svg', description: 'SVG 이미지' },
            { label: 'png', description: 'PNG 이미지' }
        ];
        const selectedType = await vscode.window.showQuickPick(typeItems, {
            placeHolder: '출력 형식을 선택하세요',
            canPickMany: false,
            ignoreFocusOut: true
        });
        if (!selectedType) {
            return;
        }
        type = selectedType.label;
    }
    await generateGraph(filePath, mode, type);
}

/**
 * Dependency Cruiser를 실행하여 그래프를 생성하고 결과를 표시합니다.
 */
function generateGraph(filePath: string, mode: string, type: string) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('워크스페이스 루트를 찾을 수 없습니다.');
        return;
    }

    // 설정 파일 경로 결정 (.option/dependency-cruiser.js 기본, 프로젝트 루트 설정 파일이 있으면 우선 사용)
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

    // reaches 모드인 경우 프로젝트 루트 기준 상대경로 사용
    let targetPath = filePath;
    if (mode === 'reaches') {
        const rel = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        targetPath = rel;
    }

    // node_modules 포함 옵션 설정 (현재 기본 포함)
    const nodeModulesOptions = '--do-not-follow node_modules --collapse "^(node_modules|lib)/[^/]+"';

    // 출력 타입 및 확장자 결정
    const ext = type;
    const actualType = type === 'mmd' ? 'mermaid' : ['svg','png','dot'].includes(type) ? type : 'mermaid';
    const needsDot = type === 'svg' || type === 'png';

    // 명령어 생성 (stdout으로 결과 받음)
    let command = '';
    if (mode === 'deps') {
        command = needsDot
            ? `npx depcruise ${configOption} "${targetPath}" ${nodeModulesOptions} --output-type dot | dot -T${type}`
            : `npx depcruise ${configOption} "${targetPath}" ${nodeModulesOptions} --output-type ${actualType}`;
    } else {
        command = needsDot
            ? `npx depcruise ${configOption} src --reaches "${targetPath}" ${nodeModulesOptions} --output-type dot | dot -T${type}`
            : `npx depcruise ${configOption} src --reaches "${targetPath}" ${nodeModulesOptions} --output-type ${actualType}`;
    }

	console.log(command);

    vscode.window.showInformationMessage(`그래프 생성 중: mode=${mode}, type=${type}`);
    // 명령 실행: stdout으로 그래프 데이터 수신
    exec(command, { cwd: workspaceRoot, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error: ExecException | null, stdout: Buffer, stderr: Buffer) => {
        if (error) {
            vscode.window.showErrorMessage(`그래프 생성 오류: ${stderr.toString() || error.message}`);
            return;
        }
        // WebView로 그래프 표시 (stdout 기반)
        showGraphInWebviewData(stdout, ext);
    });
}

/**
 * WebView로 stdout 기반 그래프 데이터를 표시 및 다운로드 링크 제공
 */
function showGraphInWebviewData(data: Buffer, ext: string) {
    const panel = vscode.window.createWebviewPanel(
        'depcruisePreview',
        'Dependency Graph',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );
    // 메시지 수신 리스너: 다운로드 요청 처리
    panel.webview.onDidReceiveMessage(async message => {
        if (message.command === 'save') {
            // 파일 저장 위치 선택
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(path.join(
                    vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
                    message.fileName
                ))
            });
            if (!uri) {
                return;
            }
            // 데이터 Buffer 생성
            const buffer = message.ext === 'png'
                ? Buffer.from(message.data, 'base64')
                : Buffer.from(decodeURIComponent(message.data), 'utf-8');
            await vscode.workspace.fs.writeFile(uri, buffer);
            vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
        }
    });
    const webview = panel.webview;
    // 콘텐츠 처리
    let body = '';
    if (ext === 'mmd') {
        body = `<div class="mermaid">${data.toString('utf-8')}</div>`;
    } else if (ext === 'svg') {
        body = data.toString('utf-8');
    } else if (ext === 'png') {
        const base64 = data.toString('base64');
        body = `<img src="data:image/png;base64,${base64}" />`;
    }
    // 다운로드 버튼 (메시지 포스트)
    const downloadData = ext === 'png'
        ? data.toString('base64')
        : encodeURIComponent(data.toString('utf-8'));
    const downloadLink = `
        <button id="download">Download dependency.${ext}</button>
        <script>
            const vscodeApi = acquireVsCodeApi();
            document.getElementById('download').addEventListener('click', () => {
                vscodeApi.postMessage({ command: 'save', data: '${downloadData}', ext: '${ext}', fileName: 'dependency.${ext}' });
            });
        </script>`;
    // HTML 렌더링
    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true });</script>
  <style>body { padding: 10px; }</style>
</head>
<body>
  ${body}
  <hr />
  ${downloadLink}
</body>
</html>`;
}