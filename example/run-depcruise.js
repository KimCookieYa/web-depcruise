const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// 명령줄 인자에서 옵션 가져오기
const filePath = process.env.npm_config_file;
const outputType = process.env.npm_config_type || 'mermaid'; // 기본값: mermaid
const dependencyMode = process.env.npm_config_mode || 'reaches'; // 기본값: reaches (다른 모듈이 이 모듈에 의존)
const includeNodeModules =
  (process.env.npm_config_include_node_modules || 'true') === 'true'; // node_modules 포함 여부, 기본값: true

// 파일 경로 확인
if (!filePath) {
  console.error(`파일 경로를 지정해주세요: 
  npm run cruise --file="파일경로" [--type=mermaid|dot|svg|png] [--mode=reaches|deps] [--include_node_modules=true|false]
  
  예시:
  npm run cruise --file="src/components/Button.tsx" --type=svg --mode=deps
  `);
  process.exit(1);
}

// 파일이 존재하는지 확인 (원본 경로 사용)
try {
  fs.accessSync(filePath, fs.constants.F_OK);
  console.log(`파일 확인 완료: ${filePath}`);
} catch (err) {
  console.error(`파일이 존재하지 않습니다: ${filePath}`);
  process.exit(1);
}

// 특수 문자 이스케이프 처리
let escapedFilePath = filePath;
if (filePath.includes('(') && !filePath.includes('\\(')) {
  escapedFilePath = filePath.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  console.log(`경로에 괄호가 있어 이스케이프 처리했습니다: ${escapedFilePath}`);
}

// 출력 파일 확장자 설정 (내부 타입과 파일 확장자 구분)
let actualOutputType = outputType;
let fileExtension;

// 올바른 출력 타입과 파일 확장자 설정
if (outputType === 'mmd') {
  actualOutputType = 'mermaid';
  fileExtension = 'mmd';
} else if (['svg', 'png', 'dot'].includes(outputType)) {
  actualOutputType = outputType;
  fileExtension = outputType;
} else {
  // 기본 mermaid 형식 사용
  actualOutputType = 'mermaid';
  fileExtension = 'mmd';
}

// 출력 디렉토리 설정 및 생성
const outputDir = '.cruise';
// 출력 디렉토리가 없으면 생성
if (!fs.existsSync(outputDir)) {
  try {
    fs.mkdirSync(outputDir);
    console.log(`출력 디렉토리 생성 완료: ${outputDir}`);
  } catch (err) {
    console.error(`출력 디렉토리 생성 실패: ${err.message}`);
    process.exit(1);
  }
}

// 출력 파일 이름 설정
const fileBaseName = path.basename(filePath, path.extname(filePath));
const outputFileName = path.join(
  outputDir,
  `dependency-${dependencyMode}-${fileBaseName}.${fileExtension}`,
);

// Dot 중간 파일이 필요한 경우
const needsDotIntermediate = outputType === 'svg' || outputType === 'png';
const dotFileName = needsDotIntermediate
  ? path.join(outputDir, `dependency-${dependencyMode}-${fileBaseName}.dot`)
  : null;

// node_modules 설정 구성
let nodeModulesOptions = '';

if (includeNodeModules) {
  // node_modules 포함 설정
  nodeModulesOptions =
    '--do-not-follow node_modules --collapse "^(node_modules|lib)/[^/]+"';
} else {
  // node_modules 제외 설정
  nodeModulesOptions = '--exclude "^(node_modules|lib)/[^/]+"';
}

// 명령어 생성
let command;

if (dependencyMode === 'deps') {
  // 이 파일이 의존하는 모듈 (outgoing dependencies)
  if (needsDotIntermediate) {
    command = `npx depcruise "${filePath}" ${nodeModulesOptions} --output-type dot > ${dotFileName} && dot -T${outputType} ${dotFileName} > ${outputFileName}`;
  } else {
    command = `npx depcruise "${filePath}" ${nodeModulesOptions} --output-type ${actualOutputType} > ${outputFileName}`;
  }
} else {
  // 이 파일에 의존하는 모듈 (incoming dependencies)
  if (needsDotIntermediate) {
    command = `npx depcruise src --reaches "${escapedFilePath}" ${nodeModulesOptions} --output-type dot > ${dotFileName} && dot -T${outputType} ${dotFileName} > ${outputFileName}`;
  } else {
    command = `npx depcruise src --reaches "${escapedFilePath}" ${nodeModulesOptions} --output-type ${actualOutputType} > ${outputFileName}`;
  }
}

console.log(`실행 중: ${command}`);
console.log(
  `모드: ${dependencyMode === 'deps' ? '이 파일이 의존하는 모듈' : '이 파일에 의존하는 모듈'}`,
);
console.log(`출력 타입: ${actualOutputType} (파일 확장자: ${fileExtension})`);
console.log(
  `node_modules 포함: ${includeNodeModules ? '예 (첫 번째 depth만)' : '아니오'}`,
);
console.log(`출력 경로: ${outputDir} 디렉토리`);

// 명령 실행
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`오류 발생: ${error.message}`);
    console.error(`명령어: ${command}`);

    return;
  }

  if (stderr) {
    console.error(`경고: ${stderr}`);
  }

  outputSuccessMessage(stdout, outputFileName);
});

// 성공 메시지 출력 함수
function outputSuccessMessage(stdout, fileName) {
  if (stdout) {
    console.log(stdout);
  }

  console.log(`의존성 그래프가 생성되었습니다: ${fileName}`);

  // 파일 크기 확인
  try {
    const stats = fs.statSync(fileName);
    if (stats.size === 0) {
      console.error('그래프 파일이 비어있습니다. 명령어를 확인해주세요.');
    } else {
      console.log(`그래프 파일 크기: ${stats.size} bytes`);

      // dot 중간 파일 삭제 (필요한 경우)
      if (needsDotIntermediate && fs.existsSync(dotFileName)) {
        fs.unlinkSync(dotFileName);
        console.log(`중간 파일 삭제: ${dotFileName}`);
      }
    }
  } catch (err) {
    console.error('파일 크기 확인 중 오류 발생:', err);
  }
}
