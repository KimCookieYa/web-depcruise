import * as vscode from 'vscode';
import * as path from 'path';

export class FileNode extends vscode.TreeItem {
    constructor(
        public readonly uri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(uri, collapsibleState);
        this.label = path.basename(uri.fsPath);
        if (this.collapsibleState === vscode.TreeItemCollapsibleState.None) {
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

export class FileExplorerProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileNode | null> = new vscode.EventEmitter<FileNode | null>();
    readonly onDidChangeTreeData: vscode.Event<FileNode | null> = this._onDidChangeTreeData.event;

    constructor() {}

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
                    return name !== 'node_modules' && !name.startsWith('.');
                }
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