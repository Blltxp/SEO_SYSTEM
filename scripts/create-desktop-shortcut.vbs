' สร้าง shortcut บน Desktop พร้อมไอคอน (ดับเบิลคลิกไฟล์นี้ครั้งเดียว)
Dim fso, root, bat, wsh, desktop, shortcut
Set fso = CreateObject("Scripting.FileSystemObject")
Set wsh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
bat = root & "\SEO-System.bat"
desktop = wsh.SpecialFolders("Desktop")

Set shortcut = wsh.CreateShortcut(desktop & "\SEO System.lnk")
shortcut.TargetPath = bat
shortcut.WorkingDirectory = root
shortcut.Description = "SEO System"
' ไอคอนจาก Windows: shell32.dll,14 = globe (เปลี่ยนตัวเลขได้ หรือชี้ไปที่ไฟล์ .ico)
shortcut.IconLocation = "C:\Windows\System32\shell32.dll,14"
shortcut.Save

WScript.Echo "Created shortcut on Desktop: SEO System.lnk" & vbCrLf & "Right-click shortcut -> Properties -> Change Icon to use another icon."
