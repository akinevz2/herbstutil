# bash completion for herbstutil

# mirrors share/herbstclient-completion.bash (hlwm): the completion
# logic lives in the binary itself — this script only calls
#   herbstutil complete-shell <position> <words...>
# and feeds the candidates to COMPREPLY.

_herbstutil_complete() {
    local IFS=$'\n'
    # do not split at '=', because BASH would not split at a '='.
    COMP_WORDBREAKS=${COMP_WORDBREAKS//=}
    COMPREPLY=(
        $(herbstutil complete-shell "$((COMP_CWORD-1))" "${COMP_WORDS[@]:1}")
    )
}

complete -F _herbstutil_complete -o nospace herbstutil
