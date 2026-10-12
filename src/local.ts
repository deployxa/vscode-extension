import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

export async function readRepository(workspace?: string) {
  let target = workspace;
  if (!target) {
    try {
      // Dynamic import so local.ts can be tested outside the VS Code runtime
      const vscode = await import('vscode');
      target = vscode.workspace?.workspaceFolders?.[0]?.uri.fsPath;
    } catch {
      target = undefined;
    }
  }
  if (!target) return undefined;
  try {
    const [{ stdout: remote }, { stdout: branch }] = await Promise.all([
      exec('git', ['config', '--get', 'remote.origin.url'], { cwd: target }),
      exec('git', ['branch', '--show-current'], { cwd: target }),
    ]);
    const remoteUrl = remote.trim();
    if (!remoteUrl) return undefined;
    return { path: target, remoteUrl, branch: branch.trim() || 'main' };
  } catch { return undefined; }
}

export async function openRepository(workspace: string) {
  const vscode = await import('vscode');
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspace));
}
