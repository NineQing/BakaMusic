Unicode true
RequestExecutionLevel user
SilentInstall silent
SilentUnInstall silent
OutFile "${OUTPUT_FILE}"
!include "LogicLib.nsh"
!include "${INSTALLER_INCLUDE}"

; Exercise the production cleanup without touching real app registrations,
; shortcuts or user data. The runner provides a disposable test directory.
Section
  ReadEnvStr $INSTDIR "BAKAMUSIC_NSIS_TEST_DIR"
  ${If} $INSTDIR == ""
    SetErrorLevel 2
    Quit
  ${EndIf}
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall BakaMusic.exe"

  ; Record whether this volume exposes the short-name collision from #22.
  FindFirst $0 $1 "$INSTDIR\unins???.exe"
  ${DoWhile} $1 != ""
    ${If} $1 == "Uninstall BakaMusic.exe"
      FileOpen $2 "$INSTDIR\short-name-match.txt" w
      FileClose $2
    ${EndIf}
    FindNext $0 $1
  ${Loop}
  FindClose $0

  StrCpy $0 "preserved-0"
  StrCpy $1 "preserved-1"
  !insertmacro removeLegacyInnoUninstallers
  ${If} $0 != "preserved-0"
  ${OrIf} $1 != "preserved-1"
    SetErrorLevel 1
    Quit
  ${EndIf}
SectionEnd

Section "Uninstall"
  FileOpen $0 "$INSTDIR\uninstaller-ran.txt" w
  FileClose $0
SectionEnd
