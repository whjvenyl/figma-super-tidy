import Tracking from 'src/utils/Tracking'

const cmd = figma.command
figma.showUI(__html__, { visible: false })

function getNodesGroupedbyPosition(nodes) {
	// Prepare nodes
	var input_ids = nodes.reduce((acc, item) => {
		acc.push({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height, name: item.name })
		return acc
	}, [])

	// Sort by X
	input_ids.sort((current, next) => {
		return current.x - next.x
	})

	// Create rows and columns
	var rows = []
	input_ids.map(item => {
		var rowExist = rows.find(row => row.y + item.height/2 > item.y && row.y - item.height/2 < item.y)
		if (rowExist) {
			rowExist.columns.push(item)
		} else {
			rows.push({ y: item.y, columns: [item] })
		}
	})

	// Sort by Y
	return rows.sort((current, next) => current.y - next.y);
}

function getNameByPosition(row, col) {
	var row_name = row*100
	var col_name = row_name + col
	var name = ''

	function zeroPad(num, places) {
		var zero = places - num.toString().length + 1;
		return Array(+(zero > 0 && zero)).join("0") + num;
	}

	if (col == 0) {
		name = (row == 0) ? zeroPad(row_name, 3) : row_name.toString();
	} else {
		name = (row == 0) ? zeroPad(col_name, 3) : col_name.toString();
	}

	return name
}

function cmdRename() {
	var selection = figma.currentPage.selection
	var parent = (selection[0].type == 'PAGE') ? figma.currentPage : selection[0].parent
	var allNodes = parent.children
	var groupedNodes = getNodesGroupedbyPosition(selection)

	groupedNodes.forEach((row, rowidx) => {
		row.columns.forEach((col, colidx) => {
			var name = getNameByPosition(rowidx, colidx)
			var match = allNodes.find(node => node.id === col.id)
			match.name = name
		})
	})
}

function cmdReorder() {
	var selection = figma.currentPage.selection
	var parent = (selection[0].type == 'PAGE') ? figma.currentPage : selection[0].parent
	var allNodes = parent.children
	var groupedNodes = getNodesGroupedbyPosition(selection)

	groupedNodes.reverse().forEach(row => {
		row.columns.reverse().forEach(col => {
			var match = allNodes.find(node => node.id === col.id)
			parent.appendChild(match)
		})
	})
}

function cmdTidy(xSpacing, ySpacing) {
	var selection = figma.currentPage.selection
	var parent = (selection[0].type == 'PAGE') ? figma.currentPage : selection[0].parent
	var allNodes = parent.children
	var groupedNodes = getNodesGroupedbyPosition(selection)

	var x0 = 0
	var y0 = 0
	var xPos = 0
	var yPos = 0
	var defaultXSpacing = (typeof xSpacing == 'undefined') ? 100 : xSpacing ;
	var defaultYSpacing = (typeof ySpacing == 'undefined') ? 200 : ySpacing ;
	var tallestInRow = []

	// Store tallest node per row
	groupedNodes.forEach((row, rowidx) => {
		let sortedRowColumns = row.columns.slice()
		sortedRowColumns.sort((prev, next) => {
			return (prev.height > next.height) ? -1 : 1;
		})
		tallestInRow.push(sortedRowColumns[0].height)
	})

	// Reposition nodes
	groupedNodes.forEach((row, rowidx) => {
		row.columns.forEach((col, colidx) => {
			if (rowidx == 0 && colidx == 0) {
				x0 = col.x
				y0 = col.y
				xPos = col.x
				yPos = col.y
			}
			var match = allNodes.find(node => node.id === col.id)
			match.x = (colidx == 0) ? xPos : xPos + defaultXSpacing;
			match.y = yPos
			xPos = match.x + match.width
		})

		xPos = x0
		yPos = yPos + (tallestInRow[rowidx] + defaultYSpacing)
	})
}

// Obtain UUID then trigger init event
figma.clientStorage.getAsync('UUID').then(data => {
	let UUID = ''

	if (!data) {
		UUID = Tracking.createUUID()
		figma.clientStorage.setAsync('UUID', UUID)
	} else {
		UUID = data
	}

	figma.ui.postMessage({ type: 'init', UUID: UUID, cmd: cmd })

	// Run with command
	if (cmd == 'rename') {
		cmdRename()
		setTimeout(() => figma.closePlugin(), 100)
	} else
	if (cmd == 'reorder') {
		cmdReorder()
		setTimeout(() => figma.closePlugin(), 100)
	} else
	if (cmd == 'tidy') {
		cmdTidy()
		setTimeout(() => figma.closePlugin(), 100)
	} else
	if (cmd == 'options') {
		figma.showUI(__html__, { width: 320, height: 360 })
		figma.ui.postMessage({ type: 'init', UUID: UUID, cmd: cmd })
		figma.ui.postMessage({ type: 'selection', selection: figma.currentPage.selection })

		figma.on('selectionchange', () => {
			figma.ui.postMessage({ type: 'selection', selection: figma.currentPage.selection })
		})

		figma.ui.onmessage = msg => {
			if (msg.type === 'tidy') {
				var X_SPACING = msg.options.spacing.x
				var Y_SPACING = msg.options.spacing.y
				var RENAMING_ENABLED = msg.options.renaming
				var REORDER_ENABLED = msg.options.reorder
				var TIDY_ENABLED = msg.options.tidy

				if (TIDY_ENABLED) cmdTidy(X_SPACING, Y_SPACING)
				if (RENAMING_ENABLED) cmdRename()
				if (REORDER_ENABLED) cmdReorder()
				figma.closePlugin()
			}
		}
	}
})


