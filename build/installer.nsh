!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh

  Var BbDialog
  Var BbCheckbox
  Var BbChecked

  ; Custom page after the install-directory page. Silent installs (auto-updates)
  ; skip pages, so BbChecked stays empty and nothing is requested.
  Function bbPageCreate
    nsDialogs::Create 1018
    Pop $BbDialog
    ${If} $BbDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 0 100% 12u "Include Bloodborne port"
    Pop $BbCheckbox
    ${NSD_CreateLabel} 12u 14u 100% 24u "Downloads the Bloodborne Windows port (about 500 MB) the first time Chimaera starts. Leave it unticked to download it later from the Bloodborne page."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function bbPageLeave
    ${NSD_GetState} $BbCheckbox $BbChecked
  FunctionEnd
!endif

!macro customPageAfterChangeDir
  !ifndef BUILD_UNINSTALLER
    Page custom bbPageCreate bbPageLeave
  !endif
!macroend

!macro customInstall
  ${If} $BbChecked == ${BST_CHECKED}
    CreateDirectory "$APPDATA\chimaera"
    FileOpen $0 "$APPDATA\chimaera\bloodborne-install-requested" w
    FileClose $0
  ${EndIf}
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\chimaera-updater"
  ${endIf}
!macroend
