/**
 * completions.ts — Shell completion script generators.
 *
 * Generates completion scripts for bash, zsh, fish, and powershell
 * from a list of CLI command names.
 */

// ── Bash ────────────────────────────────────────────────────────────

export function generateBashCompletions(commands: string[], binary = "flowti"): string {
	const list = commands.join(" ");
	return `# ${binary} bash completions
# Add to ~/.bashrc: eval "$(${binary} completions bash)"
_${binary}_completions() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    COMPREPLY=( $(compgen -W "${list}" -- "$cur") )
}
complete -F _${binary}_completions ${binary}
`;
}

// ── Zsh ─────────────────────────────────────────────────────────────

export function generateZshCompletions(commands: string[], binary = "flowti"): string {
	const items = commands.map((c) => `"${c}"`).join(" ");
	return `# ${binary} zsh completions
# Add to ~/.zshrc: eval "$(${binary} completions zsh)"
_${binary}() {
    local -a commands
    commands=(${items})
    _describe 'command' commands
}
compdef _${binary} ${binary}
`;
}

// ── Fish ────────────────────────────────────────────────────────────

export function generateFishCompletions(commands: string[], binary = "flowti"): string {
	const lines = commands.map((c) =>
		`complete -c ${binary} -f -a "${c}"`,
	);
	return `# ${binary} fish completions
# Save to ~/.config/fish/completions/${binary}.fish
${lines.join("\n")}
`;
}

// ── PowerShell ──────────────────────────────────────────────────────

export function generatePowerShellCompletions(commands: string[], binary = "flowti"): string {
	const items = commands.map((c) => `"${c}"`).join(", ");
	return `# ${binary} PowerShell completions
# Add to $PROFILE
Register-ArgumentCompleter -CommandName ${binary} -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $commands = @(${items})
    $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
}
`;
}

// ── Dispatcher ──────────────────────────────────────────────────────

export function generateCompletions(shell: string, commands: string[], binary = "flowti"): string | null {
	switch (shell) {
		case "bash": return generateBashCompletions(commands, binary);
		case "zsh": return generateZshCompletions(commands, binary);
		case "fish": return generateFishCompletions(commands, binary);
		case "powershell":
		case "pwsh": return generatePowerShellCompletions(commands, binary);
		default: return null;
	}
}
