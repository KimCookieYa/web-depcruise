import { exec, ExecException } from 'child_process';

export class DepcruiseService {
    /**
     * depcruise 및 dot 파이프 실행 후 stdout Buffer 반환
     */
    static run(
        cwd: string,
        configOption: string,
        targetPath: string,
        nodeModulesOptions: string,
        mode: string,
        format: string
    ): Promise<Buffer> {
        const actualType = format === 'mmd' ? 'mermaid' : ['svg','png','dot'].includes(format) ? format : 'mermaid';
        const needsDot = format === 'svg' || format === 'png';
        let cmd: string;
        if (mode === 'deps') {
            cmd = needsDot
                ? `npx depcruise ${configOption} "${targetPath}" ${nodeModulesOptions} --output-type dot | dot -T${format}`
                : `npx depcruise ${configOption} "${targetPath}" ${nodeModulesOptions} --output-type ${actualType}`;
        } else {
            cmd = needsDot
                ? `npx depcruise ${configOption} src --reaches "${targetPath}" ${nodeModulesOptions} --output-type dot | dot -T${format}`
                : `npx depcruise ${configOption} src --reaches "${targetPath}" ${nodeModulesOptions} --output-type ${actualType}`;
        }
        return new Promise((resolve, reject) => {
            exec(cmd, { cwd, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error: ExecException | null, stdout: Buffer, stderr: Buffer) => {
                if (error) {
                    reject(new Error(stderr.toString() || error.message));
                } else {
                    resolve(stdout);
                }
            });
        });
    }
} 