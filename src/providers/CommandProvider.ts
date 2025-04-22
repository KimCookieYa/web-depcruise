import * as vscode from 'vscode';

export class CommandItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        private readonly commandId: string,
        iconName: string
    ) {
        super(label);
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.command = {
            command: `web-depcruiser.${commandId}`,
            title: label,
        };
        this.contextValue = commandId;
    }
}

export class CommandProvider implements vscode.TreeDataProvider<CommandItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommandItem | undefined> = new vscode.EventEmitter<CommandItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<CommandItem | undefined> = this._onDidChangeTreeData.event;

    constructor() {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: CommandItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommandItem): Thenable<CommandItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        const items: CommandItem[] = [
            new CommandItem('프로젝트 전체 의존성 그래프 생성', 'showEntireGraph', 'graph'),
            new CommandItem('Web DepCruiser 설정 열기', 'openSettings', 'settings-gear'),
            new CommandItem('파일 트리 새로고침', 'refreshFileExplorer', 'refresh'),
        ];
        return Promise.resolve(items);
    }
}
