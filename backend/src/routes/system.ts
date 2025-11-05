import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const router = Router();

// Get current version from package.json
router.get('/version', async (req, res) => {
  try {
    const packagePath = path.join(__dirname, '../../../package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
    
    res.json({
      version: packageJson.version,
      name: packageJson.name
    });
  } catch (error) {
    console.error('Error reading version:', error);
    res.status(500).json({ error: 'Failed to read version' });
  }
});

// Check for available updates (from git)
router.get('/check-update', authenticateToken, async (req, res) => {
  try {
    // Fetch latest from remote
    await execAsync('git fetch origin main');
    
    // Check if there are updates
    const { stdout: localCommit } = await execAsync('git rev-parse HEAD');
    const { stdout: remoteCommit } = await execAsync('git rev-parse origin/main');
    
    const hasUpdate = localCommit.trim() !== remoteCommit.trim();
    
    // Get commit info if update available
    let updateInfo = null;
    if (hasUpdate) {
      const { stdout: commits } = await execAsync('git log HEAD..origin/main --oneline');
      const commitList = commits.trim().split('\n').filter(c => c);
      
      updateInfo = {
        available: true,
        commits: commitList.length,
        changes: commitList.slice(0, 5) // Show last 5 commits
      };
    }
    
    res.json({
      hasUpdate,
      currentCommit: localCommit.trim().substring(0, 7),
      latestCommit: remoteCommit.trim().substring(0, 7),
      updateInfo
    });
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

// Trigger update (requires admin role)
router.post('/update', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can perform updates' });
    }

    // Execute update script
    const updateScript = path.join(__dirname, '../../../update.sh');
    
    // Start update in background
    exec(`bash ${updateScript}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Update failed:', error);
        console.error('stderr:', stderr);
      } else {
        console.log('Update completed:', stdout);
      }
    });

    res.json({ 
      message: 'Update started. The application will restart automatically.',
      status: 'in_progress'
    });
  } catch (error) {
    console.error('Error starting update:', error);
    res.status(500).json({ error: 'Failed to start update' });
  }
});

export { router as systemRouter };
