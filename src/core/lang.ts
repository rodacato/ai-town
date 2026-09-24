/** "a" + place with Spanish contraction: "a la plaza", "al puente". */
export const toPlace = (label: string) => (label.startsWith('el ') ? `al ${label.slice(3)}` : `a ${label}`)

const HONORIFICS = ['sir', 'doña', 'don', 'maese', 'hermana', 'hermano', 'abuela', 'abuelo', 'fray', 'dama']

/** How the town calls someone: the first name, keeping a title like «Doña Rosalinda» or «Sir Aldric». */
export const firstName = (name: string) => {
  const [first, second] = name.split(' ')
  return second && HONORIFICS.includes(first.toLowerCase()) ? `${first} ${second}` : first
}

export const listNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : (names[0] ?? '')
