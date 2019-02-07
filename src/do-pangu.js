export default opts => {
  const fs = require('fs');
  const path = require('path');
  const readline = require('readline');
  const remark = require('remark');
  const pangu = require('remark-pangu');
  const execSync = require('child_process').execSync;
  const signale = require('signale');

  const root = process.cwd();

  let do_pangu_list = [], renamed_list = [];

  // 选择md文件
  console.log('待处理文件：');
  if (opts.allCachedFiles) {
    execSync('git ls-files -z', {
      encoding: 'utf8',
    })
      // \0 line termination on output and do not quote filenames. See OUTPUT below for more information.
      .split(String.fromCharCode(0))
      .forEach(d => {
        /\.md$/.test(path.extname(d)) && do_pangu_list.push(d) && console.log(d);
      });
  } else if (opts.onlyStagedFiles) {
    let skip = false;
    execSync('git status -sz', {
      encoding: 'utf8',
    })
      // When the -z option is given, pathnames are printed as is and without any quoting and lines are terminated with a NUL (ASCII 0x00) byte.
      .split(String.fromCharCode(0))
      .forEach(d => {
        if (!skip) {
          let fpath = d.substring(3);
          // 1.暂存区的文件，2.修改或增加或改名的文件，3.md文件
          switch (d[0]) {
            case 'R':
              skip = true;
            case 'M':
            case 'A':
              /\.md$/.test(path.extname(fpath)) && do_pangu_list.push(fpath) && console.log(fpath);
              break;
          }
        } else {
          skip = false;
        }
      });
  }

  if(!do_pangu_list.length){
    console.log('暂存区无 Markdown 文件');
  }

  // 是否修改排版？
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  new Promise((res, rej) => {
    if (opts.assumeyes) {
      res();
    } else {
      rl.question('是否修改排版[Y/n]? ', answer => {
        if ('Y' == answer) {
          res();
        } else {
          signale.info('do-pangu 停止');
          process.exit(1);
        }
      });
    }
  })
    .then(
      answer =>
        new Promise((res, rej) => {
          do_pangu_list.forEach(d => {
            let fpath = path.resolve(root, d),
              fname = path.basename(fpath, '.md'),
              fdir = path.dirname(fpath),
              data = fs.readFileSync(fpath),
              file_content = remark()
                .use(pangu)
                .use({
                  settings: {
                    commonmark: true,
                    emphasis: '*',
                    strong: '*',
                  },
                })
                .processSync(data),
              file_name = String(remark()
                .use(pangu)
                .processSync(fname)).trim() + '.md';
                
            fs.writeFileSync(fpath, String(file_content));
            if(file_name !== fname){
              renamed_list.push(file_name);
              fs.renameSync(fpath, path.resolve(fdir, ));
            }
          });
          res();
        })
    )
    .then(
      () =>
        new Promise((res, rej) => {
          if (opts.assumeyes) {
            res();
          } else {
            rl.question('是否将修改排版的文件添加到暂存区[Y/n]? ', answer => {
              if ('Y' == answer) {
                res();
              } else {
                signale.info('do-pangu 停止');
                process.exit(1);
              }
            });
          }
        })
    )
    .then(
      () =>
        new Promise((res, rej) => {
          let l = do_pangu_list.concat(renamed_list);
          l.length && execSync(`git add ${l.map(d => `"${d}"`).join(' ')}`, {
            encoding: 'utf8',
          });
          // 0成功
          signale.success('do-pangu 成功');
          process.exit(0);
        })
    );
};
