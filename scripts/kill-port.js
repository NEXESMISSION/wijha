import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const isWindows = process.platform === 'win32'

async function killPort(port) {
  try {
    if (isWindows) {
      // Windows: Find process using port and kill it
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
      const lines = stdout.trim().split('\n')
      
      if (lines.length > 0 && lines[0]) {
        const pids = new Set()
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/)
          if (parts.length > 0) {
            const pid = parts[parts.length - 1]
            if (pid && !isNaN(pid)) {
              pids.add(pid)
            }
          }
        })
        
        for (const pid of pids) {
          try {
            await execAsync(`taskkill /PID ${pid} /F`)
            console.log(`Killed process ${pid} on port ${port}`)
          } catch (error) {
            // Process might already be dead
          }
        }
      } else {
        console.log(`No process found on port ${port}`)
      }
    } else {
      // Unix/Linux/Mac: Use lsof to find and kill process
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`)
        const pids = stdout.trim().split('\n').filter(Boolean)
        
        if (pids.length > 0) {
          for (const pid of pids) {
            try {
              await execAsync(`kill -9 ${pid}`)
              console.log(`Killed process ${pid} on port ${port}`)
            } catch (error) {
              // Process might already be dead
            }
          }
        } else {
          console.log(`No process found on port ${port}`)
        }
      } catch (error) {
        // No process found on port
        console.log(`No process found on port ${port}`)
      }
    }
  } catch (error) {
    // Port might not be in use
    console.log(`Port ${port} is free`)
  }
}

const port = process.argv[2] || 3000
killPort(port).then(() => {
  process.exit(0)
}).catch(error => {
  console.error('Error killing port:', error)
  process.exit(1)
})

