import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
const exec = promisify(execFile);

export async function readRepository(workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath) {
  if (!workspace) return undefined;
  try {
    const [{ stdout: remote }, { stdout: branch }] = await Promise.all([
      exec('git', ['config', '--get', 'remote.origin.url'], { cwd: workspace }),
      exec('git', ['branch', '--show-current'], { cwd: workspace }),
    ]);
    const remoteUrl = remote.trim();
    if (!remoteUrl) return undefined;
    return { path: workspace, remoteUrl, branch: branch.trim() || 'main' };
  } catch { return undefined; }
}

export async function openRepository(workspace: string) { await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspace)); }
