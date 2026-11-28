#!/usr/bin/env python3
"""Prepare a new release worktree from validated files. Never push or deploy."""
import hashlib, json, shutil, subprocess, sys
from pathlib import Path

def git(repo,*args):
    return subprocess.check_output(['git','-C',str(repo),*args],text=True).strip()

def prepare(candidate,repository,destination):
    candidate=Path(candidate).resolve();repository=Path(repository).resolve();destination=Path(destination).resolve()
    manifest=json.loads((candidate/'RELEASE_MANIFEST.json').read_text())
    allowed=('assets/','baselines/','data/','rankings/','tests/','updater/')
    for name,expected in manifest['files'].items():
        p=Path(name)
        if p.is_absolute() or '..' in p.parts or not (name=='index.html' or name.startswith(allowed)):
            raise ValueError('Unexpected release path: '+name)
        source=candidate/p
        if not source.is_file() or source.is_symlink():raise ValueError('Missing/nonregular release file: '+name)
        # These two outputs may be recalculated, then validated by the job.
        if name not in ('index.html','data/attacker-rankings.json'):
            if hashlib.sha256(source.read_bytes()).hexdigest()!=expected:raise ValueError('Candidate changed after packaging: '+name)
    code="const fs=require('fs'),c=require('crypto'),e=require('./rankings/embed.cjs');process.stdout.write(c.createHash('sha256').update(e.strip(fs.readFileSync('index.html','utf8'))).digest('hex'))"
    actual=subprocess.check_output(['node','-e',code],cwd=candidate,text=True)
    if actual!=manifest['applicationTemplateSha256']:raise ValueError('Application behavior changed during refresh')
    changes=git(repository,'diff','--name-only',manifest['baseCommit'],'origin/main').splitlines()
    if any(name!='data/availability-check.json' for name in changes):raise ValueError('Main changed beyond availability-check bookkeeping; rebase and retest before staging')
    if destination.exists():raise ValueError('Release worktree already exists')
    subprocess.run(['git','-C',str(repository),'worktree','add','--detach',str(destination),'origin/main'],check=True)
    for name in manifest['files']:
        target=destination/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(candidate/name,target)
    # Workflow installation is a separate user upload; never ask the job token
    # to write .github/workflows or bypass GitHub's permission boundary.
    if git(destination,'diff','--name-only','--','.github'):raise ValueError('Unexpected workflow mutation')
    return len(manifest['files'])
if __name__=='__main__':
    if len(sys.argv)!=4:raise SystemExit('Usage: prepare_v78_release.py candidate repository new-worktree')
    print('Prepared',prepare(*sys.argv[1:]),'validated release files; nothing pushed or deployed')
