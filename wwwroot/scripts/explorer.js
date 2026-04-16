let directoryMap = new Map()
let allFiles = []

export async function initExplorer(data) {
    directoryMap = new Map(Object.entries(data?.directories))
    allFiles = Object.values(data?.files)
    
    window.addEventListener('popstate', handleUrlChange)
    handleUrlChange()
}

function handleUrlChange() {
    const params = new URLSearchParams(window.location.search)
    const path = params.get('path') || "."
    
    const targetDir = directoryMap.get(path)
    renderDirectory(targetDir)
}

function renderDirectory(directory) {
    const list = document.getElementById('file-list')
    const title = document.getElementById('current-folder-name')
    const backButton = document.getElementById('back-button')
    
    list.innerHTML = ''
    backButton.innerHTML = ''
    
    const displayPath = directory.relativePath === "." ? "Root" : "./" + directory.relativePath
    title.innerHTML = directory.search 
        ? directory.search 
        : `Path: ${displayPath} ` + 
            `(${directory.totalFilesInside} ${directory.totalFilesInside === 1 ? "file" : "files"}/` +
            `${directory.totalDirsInside} ${directory.totalDirsInside === 1 ? "folder" : "folders"})` +
            ` - ${directory.sizeFriendly}`

    if (directory.relativePath !== ".") {
        
        const btnUp = document.createElement('button')
        btnUp.innerText = "⬅ Up a directory"
        btnUp.style.marginRight = "10px"
        
        btnUp.onclick = () => {
            // Split path, remove the last folder, and join back
            const pathParts = directory.relativePath.split('/')
            pathParts.pop()
            const parentPath = pathParts.join('/') || "."
            
            // Call your app's navigation/fetch function here
            navigateTo(parentPath) 
        }  
        backButton.appendChild(btnUp)
    }

    const btnUpload = document.createElement('button')
    btnUpload.className = "action-btn upload"
    btnUpload.innerText = "⬆ Upload File"
    btnUpload.style.marginLeft = "10px"
    btnUpload.onclick = () => handleUpload(directory.relativePath)
    title.appendChild(btnUpload)

    const btnNewFolder = document.createElement('button')
    btnNewFolder.className = "action-btn new-folder"
    btnNewFolder.innerText = "+ New Folder"
    btnNewFolder.style.marginLeft = "15px"
    btnNewFolder.onclick = () => handleCreateFolder(directory.relativePath)
    title.appendChild(btnNewFolder)
    
    if (directory.children.length === 0) {
        const label = document.createElement('span')
        label.innerHTML = "EMPTY"
        list.appendChild(label)
    }

    const fragment = document.createDocumentFragment()

    directory.children.forEach(item => {
            const itemDiv = buildItemRow(item)            
            fragment.appendChild(itemDiv)
        })
    
        list.appendChild(fragment)
}

function buildItemRow(item) {
    const itemDiv = document.createElement('div')
    itemDiv.className = "item-row" 

    const label = document.createElement('span')            
    if (item.type === 'directory') {
        label.innerHTML = `📁 ${item.name} `
        label.className = "folder-link"
        label.onclick = () => navigateTo(item.relativePath)
    } else {
        const downloadUrl = `/download?path=${encodeURIComponent(item.relativePath)}`
        label.innerHTML = `<a href="${downloadUrl}" download>📄 ${item.name}</a>`
        label.className = "file-item"
    }

    itemDiv.appendChild(label)

    const actions = document.createElement('span')
    actions.className = "actions"

    const btnCopy = document.createElement('button')
    btnCopy.innerText = "Copy"
    btnCopy.onclick = () => handleCopy(item)

    const btnRename = document.createElement('button')
    btnRename.innerText = "Rename"
    btnRename.onclick = () => handleRename(item)

    const btnMove = document.createElement('button')
    btnMove.innerText = "Move"
    btnMove.onclick = () => handleMove(item)
    
    const btnDelete = document.createElement('button')
    btnDelete.innerText = "Delete"
    btnDelete.style.color = "red"
    btnDelete.onclick = () => handleDelete(item.relativePath)

    actions.appendChild(btnCopy)            
    actions.appendChild(btnRename)
    actions.appendChild(btnMove)
    actions.appendChild(btnDelete)
    itemDiv.appendChild(actions)

    return itemDiv
}

function navigateTo(path) {
    const newUrl = `${window.location.pathname}?path=${encodeURIComponent(path)}`
    window.history.pushState({ path }, "", newUrl)
    
    handleUrlChange()
}

async function handleDelete(path) {
    if (!confirm(`Are you sure you want to delete ${path}?`)) return

    const response = await fetch(`/delete?targetName=${encodeURIComponent(path)}`, {
        method: 'DELETE'
    })

    if (response.ok) {
        alert("Deleted successfully")
        window.location.reload()
    } else {
        alert("Delete failed")
    }
}

async function handleCopy(item) {
    const extensionIndex = item.name.lastIndexOf('.')
    const baseName = extensionIndex === -1 ? item.name : item.name.substring(0, extensionIndex)
    const extension = extensionIndex === -1 ? "" : item.name.substring(extensionIndex)
    
    const suggestedName = `${baseName}-copy${extension}`
    const newName = prompt("Enter name for the copy:", suggestedName)
    
    if (!newName || newName === item.name) return

    const parentPath = item.relativePath.includes('/') 
        ? item.relativePath.substring(0, item.relativePath.lastIndexOf('/') + 1) 
        : ""
    const destPath = parentPath + newName

    const response = await fetch(`/copy?source=${encodeURIComponent(item.relativePath)}&dest=${encodeURIComponent(destPath)}`, {
        method: 'POST'
    })

    if (response.ok) {
        alert("File copied successfully")
        window.location.reload()
    } else {
        const error = await response.text()
        alert("Error: " + error)
    }
}

async function handleMove(item) {
    let newPath = ""
    let isValid = false
    const path = item.type === "file" ? item.relativePath.replace(item.name,"") : item.relativePath        

    const alphanumericRegex = /^[a-zA-Z0-9.\/\\ _-]+$/

    while (!isValid) {        
        newPath = prompt("Enter new folder (Alphanumeric only):", path)

        if (newPath === null) return 
        if (!newPath || newPath === item.relativePath) return

        if (alphanumericRegex.test(newPath)) {
            isValid = true
        } else {
            alert("Invalid characters detected! Please use only letters, numbers, dots.")
        }
    }

    newPath = newPath.slice(-1) === "/" ? newPath : newPath + "/"

    const response = await fetch(`/move?source=${encodeURIComponent(item.relativePath)}&dest=${encodeURIComponent(newPath + item.name)}`, {
        method: 'PUT'
    })

    if (response.ok) {
        alert("File moved successfully")
        window.location.reload()
    } else {
        const error = await response.text()
        alert("Error: " + error)
    }
}

async function handleRename(item) {
    let newName = ""
    let isValid = false
    
    const alphanumericRegex = /^[a-zA-Z0-9. _-]+$/

    while (!isValid) {
        newName = prompt("Enter new name (Alphanumeric only):", item.name)

        if (newName === null) return 
        if (!newName || newName === item.name) return

        if (alphanumericRegex.test(newName)) {
            isValid = true
        } else {
            alert("Invalid characters detected! Please use only letters, numbers, dots.")
        }
    }

    const lastSlash = item.relativePath.lastIndexOf('/')
    const newPath = lastSlash === -1
        ? newName
        : item.relativePath.substring(0, lastSlash + 1) + newName

    const response = await fetch(`/move?source=${encodeURIComponent(item.relativePath)}&dest=${encodeURIComponent(newPath)}`, {
        method: 'PUT'
    })

    if (response.ok) {
        alert("Renamed successfully")
        window.location.reload()
    } else {
        const error = await response.text()
        alert("Error: " + error)
    }
}

async function handleCreateFolder(currentRelativePath) {
    let folderName = ""
    let isValid = false
    
    const alphanumericRegex = /^[a-zA-Z0-9. _-]+$/

    while (!isValid) {
        folderName = prompt("Enter name (Alphanumeric only): ")

        if (folderName === null) return 

        if (alphanumericRegex.test(folderName)) {
            isValid = true
        } else {
            alert("Invalid characters detected! Please use only letters, numbers, dots.")
        }
    }

    const fullNewPath = currentRelativePath === "." 
        ? folderName 
        : `${currentRelativePath}/${folderName}`

    const response = await fetch(`/folder?name=${encodeURIComponent(fullNewPath)}`, {
        method: 'POST'
    })

    if (response.ok) {
        alert("Folder created!")
        window.location.reload() 
    } else {
        const error = await response.text()
        alert("Error creating folder: " + error)
    }
}

async function handleUpload(currentPath) {
    const input = document.createElement('input')
    input.type = 'file'
    
    input.onchange = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)
        formData.append('targetPath', currentPath)

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        })

        if (response.ok) {
            alert("File uploaded successfully!")
            window.location.reload()
        } else {
            const error = await response.text()
            alert("Upload failed: " + error)
        }
    }
    input.click()
}

export function handleSearch(searchTerm) {
    if (!searchTerm) return handleUrlChange()

    const lowerTerm = searchTerm.toLowerCase()

    console.log(lowerTerm);
    

    const matchedFolders = Array.from(directoryMap.values()).filter(dir => 
        dir.lowerCaseName.includes(lowerTerm) && dir.relativePath !== "."
    )
    
    const matchedFiles = allFiles.filter(file => 
        file.lowerCaseName.includes(lowerTerm)
    )

    console.log(matchedFiles);
    console.log(allFiles);
    

    renderDirectory({
        search: `Results for "${searchTerm}"`,
        relativePath: "search",
        children: [...matchedFolders, ...matchedFiles]
    })
}

const response = await fetch('/contents')
const data = await response.json()
initExplorer(data)

function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

document.getElementById('search-input').addEventListener(
  'input',
  debounce((e) => handleSearch(e.target.value), 250)
)
