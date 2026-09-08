const readline = require('readline');

function readLine(prompt) {
  return new Promise(resolve => {
    const input = readline.createInterface({ input: process.stdin, output: process.stdout });
    input.question(prompt, answer => { input.close(); resolve(answer.trim()); });
  });
}

async function readValue(prompt, environmentName) {
  const configured = process.env[environmentName];
  return configured === undefined ? readLine(prompt) : String(configured).trim();
}

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('대화형 터미널이 아닙니다. 비밀번호 환경변수를 임시로 설정한 뒤 다시 실행하세요.');
  }
  return new Promise((resolve, reject) => {
    const characters = [];
    readline.emitKeypressEvents(process.stdin);
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error, value) => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') return finish(new Error('입력이 취소되었습니다.'));
      if (key.name === 'return' || key.name === 'enter') return finish(null, characters.join(''));
      if (key.name === 'backspace') { characters.pop(); return; }
      if (!key.ctrl && !key.meta && character) characters.push(character);
    };
    process.stdin.on('keypress', onKeypress);
  });
}

async function readPassword(prompt, environmentName) {
  const configured = process.env[environmentName];
  return configured === undefined ? readHidden(prompt) : String(configured);
}

module.exports = { readValue, readPassword };
