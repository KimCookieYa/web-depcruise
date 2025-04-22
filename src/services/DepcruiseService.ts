import { exec, ExecException } from 'child_process';
import * as path from 'path';

export class DepcruiseService {
    /**
     * depcruise 및 dot 파이프 실행 후 stdout Buffer 반환
     */
    static run(
        cwd: string,
        configOption: string,
        sourceDir: string,
        targetPath: string,
        nodeModulesOptions: string,
        mode: string,
        format: string
    ): Promise<Buffer> {
        const actualType = format === 'mmd' ? 'mermaid' : ['svg','png','dot'].includes(format) ? format : 'mermaid';
        const needsDot = format === 'svg' || format === 'png';
        const sourceDirPath = sourceDir === '.' ? '.' : `"${sourceDir}"`;
        // targetPath를 workspaceRoot 기준 상대경로로 사용
        const relativeTarget = path.isAbsolute(targetPath)
            ? path.relative(cwd, targetPath).replace(/\\/g, '/')
            : targetPath;
        // reaches 옵션용 정규식: 경로 전체 매칭
        const regex = `^${relativeTarget.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`;
        let cmd: string;
        if (mode === 'deps') {
            cmd = needsDot
                ? `npx depcruise ${configOption} "${targetPath}" ${nodeModulesOptions} --output-type dot | dot -T${format}`
                : `npx depcruise ${configOption} "${targetPath}" ${nodeModulesOptions} --output-type ${actualType}`;
        } else {
            // reaches 모드: scanning path 먼저, --reaches 옵션 적용 
            cmd = needsDot
                ? `npx depcruise . ${configOption} --reaches ${regex} ${nodeModulesOptions} --output-type dot | dot -T${format}`
                : `npx depcruise . ${configOption} --reaches ${regex} ${nodeModulesOptions} --output-type ${actualType}`;
        }
        console.log(cmd);
        return new Promise<Buffer>((resolve, reject) => {
            exec(
                cmd,
                { cwd },
                (error: ExecException | null, stdout: Buffer | string, stderr: Buffer | string) => {
                    if (error) {
                        // stderr가 문자열 또는 Buffer일 수 있으므로 메시지를 추출
                        console.log(error);
                        const msg = typeof stderr === 'string' ? stderr : stderr.toString();
                        reject(new Error(msg || error.message));
                    } else {
                        // stdout이 문자열인 경우 Buffer로 변환
                        const buffer = typeof stdout === 'string' ? Buffer.from(stdout) : stdout;
                        resolve(buffer);
                    }
                }
            );
        });
    }
}