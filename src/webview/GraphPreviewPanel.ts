import * as vscode from 'vscode';
import * as path from 'path';

export class GraphPreviewPanel {
    private static currentPanel: GraphPreviewPanel | undefined;
    private panel: vscode.WebviewPanel;

    private constructor(data: Buffer, ext: string) {
        this.panel = vscode.window.createWebviewPanel(
            'depcruisePreview',
            'Dependency Graph',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );
        // 패널 dispose 시 currentPanel 초기화
        this.panel.onDidDispose(() => {
            GraphPreviewPanel.currentPanel = undefined;
        });
        // 웹뷰 메시지 수신
        this.panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'save') {
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(
                        path.join(
                            vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
                            message.fileName
                        )
                    )
                });
                if (!uri) return;
                const buffer = message.ext === 'png'
                    ? Buffer.from(message.data, 'base64')
                    : Buffer.from(decodeURIComponent(message.data), 'utf-8');
                await vscode.workspace.fs.writeFile(uri, buffer);
                vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
            }
        });
        this.update(data, ext);
    }

    public static showData(data: Buffer, ext: string) {
        if (GraphPreviewPanel.currentPanel) {
            GraphPreviewPanel.currentPanel.update(data, ext);
            GraphPreviewPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            GraphPreviewPanel.currentPanel = new GraphPreviewPanel(data, ext);
        }
    }

    private update(data: Buffer, ext: string) {
        let body = '';
        if (ext === 'mmd') {
            body = `<div class="mermaid">${data.toString('utf-8')}</div>`;
        } else if (ext === 'svg') {
            body = data.toString('utf-8');
        } else if (ext === 'png') {
            const base64 = data.toString('base64');
            body = `<img src="data:image/png;base64,${base64}" />`;
        }
        const fileName = `dependency.${ext}`;
        const dataEncoded = ext === 'png'
            ? data.toString('base64')
            : encodeURIComponent(data.toString('utf-8'));
        const downloadButton = `
            <button id="download">Download ${fileName}</button>
            <script>
                const vscodeApi = acquireVsCodeApi();
                document.getElementById('download').addEventListener('click', () => {
                    vscodeApi.postMessage({ command: 'save', data: '${dataEncoded}', ext: '${ext}', fileName: '${fileName}' });
                });
            </script>
        `;
        this.panel.webview.html = `<!DOCTYPE html>
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
  ${downloadButton}
</body>
</html>`;
    }
} 