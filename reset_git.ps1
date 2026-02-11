# Reset Git History to "0 Commits" (1 Initial Commit)

# 1. Remove existing git history
if (Test-Path .git) {
    Remove-Item -Path .git -Recurse -Force
    Write-Host "Removed old .git folder."
}

# 2. Re-initialize Git
git init
git branch -m main
Write-Host "Initialized new git repository."

# 3. Add all files
git add .
git commit -m "Initial Release"
Write-Host "Created 'Initial Release' commit."

# 4. Link to Remote (Change URL if needed, I grabbed this from your screenshot)
$RemoteUrl = "https://github.com/sahilparihar-git/PortTheFolio-Ai-CV-Scanner.git"
git remote add origin $RemoteUrl

# 5. Force Push (Overwrites remote history)
Write-Host "Pushing to remote... (This might take a moment)"
git push -u origin main --force

Write-Host "Done! Repository history has been reset."
