import { exec, ExecException } from 'child_process';
import * as path from 'path';
// CLI 실행을 위한 service

export class DepcruiseService {
    /**
     * npx depcruise CLI를 호출해 의존성 그래프를 생성하고 Buffer를 반환합니다.
     */
    static run(
        cwd: string,
        configPath: string,
        sourceDir: string,
        targetPath: string,
        includeNodeModules: boolean,
        collapsePattern: string,
        mode: 'deps' | 'reaches',
        format: 'mmd' | 'svg' | 'png',
        dotPath: string
    ): Promise<Buffer> {
        // config 옵션
        const configOption = `--config "${configPath}"`;
        // node_modules follow/collapse or exclude 옵션
        const nmOpt = includeNodeModules
            ? `--do-not-follow node_modules --collapse "${collapsePattern}"`
            : `--exclude "${collapsePattern}"`;
        // reaches 옵션
        const reachesOpt = mode === 'reaches'
            ? `--reaches "${targetPath.replace(/\\/g, '/')}"`
            : '';
        // entry 인자
        const entryArg = mode === 'deps' ? `"${targetPath}"` : '.';
        // output type
        const outType = format === 'mmd' ? 'mermaid' : format;
        // CLI 커맨드 빌드
        let cmd = `npx --yes --package dependency-cruiser depcruise ${entryArg} ${configOption} ${nmOpt} ${reachesOpt} --output-type ${outType}`;
        // dot 처리
        if (format === 'svg' || format === 'png') {
            cmd += ` | "${dotPath}" -T${format}`;
        }
        console.log(cmd);
        return new Promise<Buffer>((resolve, reject) => {
            exec(cmd, { cwd }, (err: ExecException | null, stdout, stderr) => {
                if (err) {
                    const msg = stderr?.toString() || err.message;
                    reject(new Error(msg));
                } else {
                    resolve(Buffer.from(stdout.toString()));
                }
            });
        });
    }
}