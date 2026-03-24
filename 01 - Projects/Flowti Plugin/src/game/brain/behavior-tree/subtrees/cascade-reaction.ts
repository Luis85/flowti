export const CASCADE_REACTION_SUBTREE = `root [CascadeReaction] {
	sequence {
		condition [HasCascadeHint]
		action [ReactToCascade]
	}
}`;
