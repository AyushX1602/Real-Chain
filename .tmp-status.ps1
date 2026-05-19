git log --oneline -10 > .tmp-git-log.txt 2>&1
git status --short >> .tmp-git-log.txt 2>&1
git rev-parse HEAD >> .tmp-git-log.txt 2>&1
git log -1 --stat >> .tmp-git-log.txt 2>&1
