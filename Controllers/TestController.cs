using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Linq;

namespace TestProject.Controllers {
    [ApiController]
    [Route("[controller]")]
    public class TestController : ControllerBase {

        private readonly ILogger<TestController> _logger;
        private readonly string _absolutePath;

        public TestController(ILogger<TestController> logger, IConfiguration configuration, IWebHostEnvironment env) {
            
            string relativePath = configuration["TARGET_PATH"] ?? "DefaultData";            
            _absolutePath = Path.Combine(env.ContentRootPath, relativePath);            
            _absolutePath = Path.GetFullPath(_absolutePath);

            _logger = logger;
        }
     
        // GET: GET /contents
        [HttpGet("~/contents")]
        public IActionResult GetContents()
        {
            var folderMap = new Dictionary<string, object>();
            var allFilesList = new List<object>();
            var root = new DirectoryInfo(_absolutePath);
            
            BuildTreeMap(root, folderMap, allFilesList);

            return Ok(new 
            { 
                directories = folderMap, 
                files = allFilesList 
            });
        }

        // CREATE: POST /folder?name=NewFolder
        [HttpPost("~/folder")]
        public IActionResult CreateFolder(string name)
        {
            var target = Path.Combine(_absolutePath, name);
            if (!IsSafePath(target)) return BadRequest("Invalid path.");
            
            System.IO.Directory.CreateDirectory(target);
            return Ok($"Folder '{name}' created.");
        }

        // DELETE: DELETE ?targetName=old_file.txt
        [HttpDelete("~/delete")]
        public IActionResult Delete(string targetName)
        {
            var target = Path.Combine(_absolutePath, targetName);
            if (!IsSafePath(target)) return BadRequest("Invalid path.");

            if (System.IO.Directory.Exists(target)) {
                System.IO.Directory.Delete(target, true);
            } else if (System.IO.File.Exists(target)) {
                System.IO.File.Delete(target);
            } else {
                return NotFound();
            }
            return Ok("Deleted successfully.");
        }

        // MOVE/RENAME: PUT /move?source=a.txt&dest=b.txt
        [HttpPut("~/move")]
        public IActionResult Move(string source, string dest)
        {
            var srcPath = Path.Combine(_absolutePath, source);
            var destPath = Path.Combine(_absolutePath, dest);

            if (!IsSafePath(srcPath) || !IsSafePath(destPath)) return BadRequest("Invalid paths.");

            var destDirectory = Path.GetDirectoryName(destPath);

            if (destDirectory != null && !System.IO.Directory.Exists(destDirectory))
            {
                System.IO.Directory.CreateDirectory(destDirectory);
            }

            if (System.IO.Directory.Exists(srcPath))
            {
                System.IO.Directory.Move(srcPath, destPath);
            }
            else if (System.IO.File.Exists(srcPath))
            {
                System.IO.File.Move(srcPath, destPath);
            }
            else
            {
                return NotFound("Source file or folder not found.");
            }

            return Ok("Moved successfully.");
        }

        // COPY: POST /move?source=a.txt&dest=b.txt
        [HttpPost("~/copy")]
        public IActionResult Copy(string source, string dest)
        {
            var srcPath = Path.Combine(_absolutePath, source);
            var destPath = Path.Combine(_absolutePath, dest);

            if (!IsSafePath(srcPath) || !IsSafePath(destPath)) return BadRequest("Invalid paths.");

            try
            {
                if (System.IO.File.Exists(srcPath))
                {
                    System.IO.File.Copy(srcPath, destPath, true);
                    return Ok("File copied.");
                }
                else if (System.IO.Directory.Exists(srcPath))
                {
                    CopyDirectory(srcPath, destPath);
                    return Ok("Directory copied.");
                }

                return NotFound("Source not found.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Copy failed: {ex.Message}");
            }
        }

        // DOWNLOAD: GET /download?path=folder/file.txt
        [HttpGet("~/download")]
        public IActionResult DownloadFile(string path)
        {
            var target = Path.Combine(_absolutePath, path);

            if (!IsSafePath(target) || !System.IO.File.Exists(target))
                return NotFound("File not found.");

            var contentType = "application/octet-stream";
            return PhysicalFile(target, contentType, Path.GetFileName(target));
        }

        [HttpPost("~/upload")]
        public async Task<IActionResult> UploadFile([FromForm] IFormFile file, [FromForm] string? targetPath = ".")
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            var fileName = Path.GetFileName(file.FileName); 
            var savePath = Path.Combine(_absolutePath, targetPath ?? ".");
            var fullPath = Path.Combine(savePath, fileName);
            if (!IsSafePath(fullPath)) return BadRequest("Invalid destination path.");

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { fileName, size = file.Length });
        }

        private bool IsSafePath(string path) => Path.GetFullPath(path).StartsWith(_absolutePath);
      
        private void BuildTreeMap(DirectoryInfo directory, Dictionary<string, object> map, List<object> fileList)
        {
            var relativePath = Path.GetRelativePath(_absolutePath, directory.FullName);

            // 1. Process immediate files
            var fileEntries = directory.GetFiles().Select(f => new {
                Name = f.Name,
                LowerCaseName = f.Name.ToLower(),
                RelativePath = Path.GetRelativePath(_absolutePath, f.FullName),
                Type = "file",
                Size = f.Length
            }).ToList();

            fileList.AddRange(fileEntries);

            foreach (var d in directory.GetDirectories())
            {
                BuildTreeMap(d, map, fileList);
            }

            long totalSize = fileEntries.Sum(f => f.Size);
            int totalFiles = fileEntries.Count;
            int totalDirs = 0;

            var subDirEntries = new List<object>();

            foreach (var d in directory.GetDirectories())
            {
                var childPath = Path.GetRelativePath(_absolutePath, d.FullName);
                
                dynamic child = map[childPath];
                
                totalSize += (long)child.SizeBytes;
                totalFiles += (int)child.TotalFilesInside;
                totalDirs += 1 + (int)child.TotalDirsInside;

                subDirEntries.Add(child);
            }

            var dirEntry = new
            {
                Name = directory.Name,
                LowerCaseName = directory.Name.ToLower(),
                RelativePath = relativePath,
                Type = "directory",
                Children = subDirEntries.Concat(fileEntries.Cast<object>()).ToList(),
                TotalFilesInside = totalFiles,
                TotalDirsInside = totalDirs,
                SizeBytes = totalSize,
                SizeFriendly = FormatSize(totalSize)
            };

            map[relativePath] = dirEntry;
        }

        private string FormatSize(long bytes)
        {
            string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
            int counter = 0;
            decimal number = bytes;
            while (Math.Round(number / 1024) >= 1)
            {
                number /= 1024;
                counter++;
            }
            return $"{number:n1} {suffixes[counter]}";
        }

        private void CopyDirectory(string sourceDir, string destDir)
        {
            System.IO.Directory.CreateDirectory(destDir);

            // Copy all files
            foreach (string file in System.IO.Directory.GetFiles(sourceDir))
            {
                string fileName = Path.GetFileName(file);
                string destFile = Path.Combine(destDir, fileName);
                System.IO.File.Copy(file, destFile, true);
            }

            // Recursively copy subdirectories
            foreach (string subDir in System.IO.Directory.GetDirectories(sourceDir))
            {
                string dirName = Path.GetFileName(subDir);
                string destSubDir = Path.Combine(destDir, dirName);
                CopyDirectory(subDir, destSubDir);
            }
        }
    }
}