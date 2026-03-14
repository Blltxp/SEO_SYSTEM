' ดับเบิลคลิกแล้วเปิดเบราว์เซอร์ (โชว์หน้าต่าง CMD)
Dim fso, root, bat, wsh
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
bat = root & "\scripts\start-seo-system.bat"
Set wsh = CreateObject("Wscript.Shell")
wsh.Run "cmd /c cd /d """ & root & """ && """ & bat & """", 1, False
