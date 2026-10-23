!define BAKAMUSIC_INNO_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{BakaMusic}_is1"

; Preserve the install scope and directory selected with the former Inno Setup
; installer. The old uninstall entry is removed only after NSIS has installed
; the replacement successfully.
!macro customInit
  ReadRegStr $0 HKCU "${BAKAMUSIC_INNO_UNINSTALL_KEY}" "InstallLocation"
  ${If} $0 != ""
    WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$0"
  ${EndIf}

  ${If} ${UAC_IsAdmin}
    ReadRegStr $0 HKLM "${BAKAMUSIC_INNO_UNINSTALL_KEY}" "InstallLocation"
    ${If} $0 != ""
      WriteRegStr HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$0"
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstallMode
  ReadRegStr $0 HKCU "${BAKAMUSIC_INNO_UNINSTALL_KEY}" "InstallLocation"
  ReadRegStr $1 HKLM "${BAKAMUSIC_INNO_UNINSTALL_KEY}" "InstallLocation"

  ${If} $0 != ""
  ${AndIf} $1 == ""
    StrCpy $isForceCurrentInstall "1"
  ${ElseIf} $0 == ""
  ${AndIf} $1 != ""
    StrCpy $isForceMachineInstall "1"
  ${EndIf}
!macroend

; NSIS Delete also matches Windows 8.3 aliases: unins???.exe matches
; UNINST~1.EXE (Uninstall BakaMusic.exe). Enumerate Inno's numeric filenames
; explicitly because customInstall runs AFTER the new uninstaller is written.
!macro removeLegacyInnoUninstallers
  Push $0
  Push $1
  StrCpy $0 0
  ${Do}
    IntFmt $1 "%03u" $0
    Delete "$INSTDIR\unins$1.dat"
    Delete "$INSTDIR\unins$1.exe"
    Delete "$INSTDIR\unins$1.msg"
    IntOp $0 $0 + 1
  ${LoopUntil} $0 > 999
  Pop $1
  Pop $0
!macroend

!macro customInstall
  DeleteRegKey SHELL_CONTEXT "${BAKAMUSIC_INNO_UNINSTALL_KEY}"
  ${If} $installMode == "all"
    DeleteRegKey HKCU "${BAKAMUSIC_INNO_UNINSTALL_KEY}"
  ${EndIf}

  !insertmacro removeLegacyInnoUninstallers
!macroend
