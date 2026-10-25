# Shows a small Windows password box (the typed characters are hidden) and returns the text, or $null if cancelled.
# Used by create-release-key.ps1 and build-release.ps1 so the signing key password is typed by the owner,
# kept in memory for that one run, and never written to disk.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Read-PasswordDialog {
    param([string]$Title, [string]$Message)
    $form = New-Object System.Windows.Forms.Form
    $form.Text = $Title
    $form.ClientSize = New-Object System.Drawing.Size(460, 170)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true

    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Message
    $label.Location = New-Object System.Drawing.Point(16, 12)
    $label.Size = New-Object System.Drawing.Size(428, 64)

    $box = New-Object System.Windows.Forms.TextBox
    $box.UseSystemPasswordChar = $true
    $box.Location = New-Object System.Drawing.Point(16, 84)
    $box.Size = New-Object System.Drawing.Size(428, 24)

    $ok = New-Object System.Windows.Forms.Button
    $ok.Text = 'OK'
    $ok.Location = New-Object System.Drawing.Point(284, 126)
    $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Text = 'Cancel'
    $cancel.Location = New-Object System.Drawing.Point(369, 126)
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel

    $form.AcceptButton = $ok
    $form.CancelButton = $cancel
    $form.Controls.AddRange(@($label, $box, $ok, $cancel))
    $form.Add_Shown({ $form.Activate(); $box.Focus() | Out-Null })

    $result = $form.ShowDialog()
    $text = $box.Text
    $form.Dispose()
    if ($result -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
    return $text
}
