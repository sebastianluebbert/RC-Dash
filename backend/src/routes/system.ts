import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const router = Router();

// Get current version from git tags
router.get('/version', async (req, res) => {
  try {
    // In Docker, package.json is in the app root
    const packagePath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
    
    // Try to get version from git tag
    let gitVersion = null;
    let gitTag = null;
    try {
      const { stdout: tagOutput } = await execAsync('git describe --tags --abbrev=0 2>/dev/null || echo ""');
      gitTag = tagOutput.trim();
      if (gitTag) {
        gitVersion = gitTag.replace(/^v/, ''); // Remove 'v' prefix if present
      }
    } catch (error) {
      console.log('No git tags found');
    }
    
    // Get current commit info
    let commitInfo = null;
    try {
      const { stdout: commitHash } = await execAsync('git rev-parse --short HEAD');
      const { stdout: commitDate } = await execAsync('git log -1 --format=%ai');
      commitInfo = {
        hash: commitHash.trim(),
        date: commitDate.trim()
      };
    } catch (error) {
      console.log('Could not get commit info');
    }
    
    res.json({
      version: gitVersion || packageJson.version,
      packageVersion: packageJson.version,
      name: packageJson.name,
      gitTag: gitTag || null,
      commit: commitInfo
    });
  } catch (error) {
    console.error('Error reading version:', error);
    res.status(500).json({ error: 'Failed to read version' });
  }
});

// Get all version tags
router.get('/tags', async (req, res) => {
  try {
    const { stdout } = await execAsync('git tag -l --sort=-version:refname');
    const tags = stdout.trim().split('\n').filter(t => t);
    
    // Get detailed info for each tag
    const tagDetails = await Promise.all(
      tags.slice(0, 20).map(async (tag) => {
        try {
          const { stdout: date } = await execAsync(`git log -1 --format=%ai ${tag}`);
          const { stdout: message } = await execAsync(`git tag -l --format='%(contents)' ${tag}`);
          const { stdout: commit } = await execAsync(`git rev-list -n 1 ${tag}`);
          
          return {
            tag,
            version: tag.replace(/^v/, ''),
            date: date.trim(),
            message: message.trim() || 'No release notes',
            commit: commit.trim().substring(0, 7)
          };
        } catch (error) {
          return {
            tag,
            version: tag.replace(/^v/, ''),
            date: null,
            message: 'No release notes',
            commit: null
          };
        }
      })
    );
    
    res.json({
      tags: tagDetails,
      total: tags.length
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Check for available updates (from git)
router.get('/check-update', authenticateToken, async (req, res) => {
  try {
    // Fetch latest from remote
    await execAsync('git fetch origin main --tags');
    
    // Check if there are updates
    const { stdout: localCommit } = await execAsync('git rev-parse HEAD');
    const { stdout: remoteCommit } = await execAsync('git rev-parse origin/main');
    
    const hasUpdate = localCommit.trim() !== remoteCommit.trim();
    
    // Get current and latest version tags
    let currentVersion = null;
    let latestVersion = null;
    
    try {
      const { stdout: currentTag } = await execAsync('git describe --tags --abbrev=0 2>/dev/null || echo ""');
      currentVersion = currentTag.trim() || null;
      
      const { stdout: latestTag } = await execAsync('git describe --tags --abbrev=0 origin/main 2>/dev/null || echo ""');
      latestVersion = latestTag.trim() || null;
    } catch (error) {
      console.log('Could not fetch version tags');
    }
    
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
      currentVersion,
      latestVersion,
      hasVersionUpdate: currentVersion !== latestVersion && latestVersion !== null,
      updateInfo
    });
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

// Get changelog between versions
router.get('/changelog', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const range = from && to ? `${from}..${to}` : 'HEAD~10..HEAD';
    
    // Get detailed commit information
    const { stdout } = await execAsync(
      `git log ${range} --pretty=format:'{"commit":"%H","short":"%h","author":"%an","date":"%ai","message":"%s","body":"%b"},' --no-merges`
    );
    
    if (!stdout.trim()) {
      return res.json({ commits: [] });
    }
    
    // Parse commits (remove trailing comma and wrap in array)
    const commitsJson = '[' + stdout.trim().slice(0, -1) + ']';
    const commits = JSON.parse(commitsJson);
    
    // Categorize commits
    const categorized = commits.map((commit: any) => {
      const msg = commit.message.toLowerCase();
      let category = 'other';
      let type = 'feature';
      
      if (msg.startsWith('feat:') || msg.includes('add') || msg.includes('new')) {
        category = 'features';
        type = 'feature';
      } else if (msg.startsWith('fix:') || msg.includes('fix') || msg.includes('bug')) {
        category = 'fixes';
        type = 'fix';
      } else if (msg.startsWith('docs:') || msg.includes('documentation')) {
        category = 'documentation';
        type = 'docs';
      } else if (msg.startsWith('style:') || msg.includes('style') || msg.includes('ui')) {
        category = 'improvements';
        type = 'improvement';
      } else if (msg.startsWith('refactor:') || msg.includes('refactor')) {
        category = 'improvements';
        type = 'refactor';
      } else if (msg.startsWith('perf:') || msg.includes('performance')) {
        category = 'improvements';
        type = 'performance';
      } else if (msg.startsWith('security:') || msg.includes('security')) {
        category = 'security';
        type = 'security';
      }
      
      return {
        ...commit,
        category,
        type
      };
    });
    
    // Group by category
    const grouped = categorized.reduce((acc: any, commit: any) => {
      if (!acc[commit.category]) {
        acc[commit.category] = [];
      }
      acc[commit.category].push(commit);
      return acc;
    }, {});
    
    res.json({
      commits: categorized,
      grouped,
      total: commits.length
    });
  } catch (error) {
    console.error('Error fetching changelog:', error);
    res.status(500).json({ error: 'Failed to fetch changelog' });
  }
});

// Trigger update (requires admin role)
router.post('/update', authenticateToken, async (req: any, res) => {
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
