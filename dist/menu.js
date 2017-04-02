var ref = require("prosemirror-menu");
var wrapItem = ref.wrapItem;
var blockTypeItem = ref.blockTypeItem;
var Dropdown = ref.Dropdown;
var DropdownSubmenu = ref.DropdownSubmenu;
var joinUpItem = ref.joinUpItem;
var liftItem = ref.liftItem;
var selectParentNodeItem = ref.selectParentNodeItem;
var undoItem = ref.undoItem;
var redoItem = ref.redoItem;
var icons = ref.icons;
var MenuItem = ref.MenuItem;
var ref$1 = require("prosemirror-schema-table");
var createTable = ref$1.createTable;
var addColumnBefore = ref$1.addColumnBefore;
var addColumnAfter = ref$1.addColumnAfter;
var removeColumn = ref$1.removeColumn;
var addRowBefore = ref$1.addRowBefore;
var addRowAfter = ref$1.addRowAfter;
var removeRow = ref$1.removeRow;
var ref$2 = require("prosemirror-state");
var Selection = ref$2.Selection;
var NodeSelection = ref$2.NodeSelection;
var ref$3 = require("prosemirror-commands");
var toggleMark = ref$3.toggleMark;
var ref$4 = require("prosemirror-schema-list");
var wrapInList = ref$4.wrapInList;
var ref$5 = require("./prompt");
var TextField = ref$5.TextField;
var openPrompt = ref$5.openPrompt;

// Helpers to create specific types of items

function canInsert(state, nodeType, attrs) {
  var $from = state.selection.$from
  for (var d = $from.depth; d >= 0; d--) {
    var index = $from.index(d)
    if ($from.node(d).canReplaceWith(index, index, nodeType, attrs)) { return true }
  }
  return false
}

function insertImageItem(nodeType) {
  return new MenuItem({
    title: "Insert image",
    label: "Image",
    select: function select(state) { return canInsert(state, nodeType) },
    run: function run(state, _, view) {
      var ref = state.selection;
      var from = ref.from;
      var to = ref.to;
      var attrs = null
      if (state.selection instanceof NodeSelection && state.selection.node.type == nodeType)
        { attrs = state.selection.node.attrs }
      openPrompt({
        title: "Insert image",
        fields: {
          src: new TextField({label: "Location", required: true, value: attrs && attrs.src}),
          title: new TextField({label: "Title", value: attrs && attrs.title}),
          alt: new TextField({label: "Description",
                              value: attrs ? attrs.title : state.doc.textBetween(from, to, " ")})
        },
        callback: function callback(attrs) {
          view.dispatch(view.state.tr.replaceSelectionWith(nodeType.createAndFill(attrs)))
          view.focus()
        }
      })
    }
  })
}

function positiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) { return "Should be a positive integer" }
}

function insertTableItem(tableType) {
  return new MenuItem({
    title: "Insert a table",
    run: function run(_, _a, view) {
      openPrompt({
        title: "Insert table",
        fields: {
          rows: new TextField({label: "Rows", validate: positiveInteger}),
          cols: new TextField({label: "Columns", validate: positiveInteger})
        },
        callback: function callback(ref) {
          var rows = ref.rows;
          var cols = ref.cols;

          var tr = view.state.tr.replaceSelectionWith(createTable(tableType, +rows, +cols))
          tr.setSelection(Selection.near(tr.doc.resolve(view.state.selection.from)))
          view.dispatch(tr.scrollIntoView())
          view.focus()
        }
      })
    },
    select: function select(state) {
      var $from = state.selection.$from
      for (var d = $from.depth; d >= 0; d--) {
        var index = $from.index(d)
        if ($from.node(d).canReplaceWith(index, index, tableType)) { return true }
      }
      return false
    },
    label: "Table"
  })
}

function cmdItem(cmd, options) {
  var passedOptions = {
    label: options.title,
    run: cmd,
    select: function select(state) { return cmd(state) }
  }
  for (var prop in options) { passedOptions[prop] = options[prop] }
  return new MenuItem(passedOptions)
}

function markActive(state, type) {
  var ref = state.selection;
  var from = ref.from;
  var $from = ref.$from;
  var to = ref.to;
  var empty = ref.empty;
  if (empty) { return type.isInSet(state.storedMarks || $from.marks()) }
  else { return state.doc.rangeHasMark(from, to, type) }
}

function markItem(markType, options) {
  var passedOptions = {
    active: function active(state) { return markActive(state, markType) }
  }
  for (var prop in options) { passedOptions[prop] = options[prop] }
  return cmdItem(toggleMark(markType), passedOptions)
}

function linkItem(markType) {
  return markItem(markType, {
    title: "Add or remove link",
    icon: icons.link,
    run: function run(state, dispatch, view) {
      if (markActive(state, markType)) {
        toggleMark(markType)(state, dispatch)
        return true
      }
      openPrompt({
        title: "Create a link",
        fields: {
          href: new TextField({
            label: "Link target",
            required: true,
            clean: function (val) {
              if (!/^https?:\/\//i.test(val))
                { val = 'http://' + val }
              return val
            }
          }),
          title: new TextField({label: "Title"})
        },
        callback: function callback(attrs) {
          toggleMark(markType, attrs)(view.state, view.dispatch)
          view.focus()
        }
      })
    }
  })
}

function wrapListItem(nodeType, options) {
  return cmdItem(wrapInList(nodeType, options.attrs), options)
}

// :: (Schema) → Object
// Given a schema, look for default mark and node types in it and
// return an object with relevant menu items relating to those marks:
//
// **`toggleStrong`**`: MenuItem`
//   : A menu item to toggle the [strong mark](#schema-basic.StrongMark).
//
// **`toggleEm`**`: MenuItem`
//   : A menu item to toggle the [emphasis mark](#schema-basic.EmMark).
//
// **`toggleCode`**`: MenuItem`
//   : A menu item to toggle the [code font mark](#schema-basic.CodeMark).
//
// **`toggleLink`**`: MenuItem`
//   : A menu item to toggle the [link mark](#schema-basic.LinkMark).
//
// **`insertImage`**`: MenuItem`
//   : A menu item to insert an [image](#schema-basic.Image).
//
// **`wrapBulletList`**`: MenuItem`
//   : A menu item to wrap the selection in a [bullet list](#schema-list.BulletList).
//
// **`wrapOrderedList`**`: MenuItem`
//   : A menu item to wrap the selection in an [ordered list](#schema-list.OrderedList).
//
// **`wrapBlockQuote`**`: MenuItem`
//   : A menu item to wrap the selection in a [block quote](#schema-basic.BlockQuote).
//
// **`makeParagraph`**`: MenuItem`
//   : A menu item to set the current textblock to be a normal
//     [paragraph](#schema-basic.Paragraph).
//
// **`makeCodeBlock`**`: MenuItem`
//   : A menu item to set the current textblock to be a
//     [code block](#schema-basic.CodeBlock).
//
// **`insertTable`**`: MenuItem`
//   : An item to insert a [table](#schema-table).
//
// **`addRowBefore`**, **`addRowAfter`**, **`removeRow`**, **`addColumnBefore`**, **`addColumnAfter`**, **`removeColumn`**`: MenuItem`
//   : Table-manipulation items.
//
// **`makeHead[N]`**`: MenuItem`
//   : Where _N_ is 1 to 6. Menu items to set the current textblock to
//     be a [heading](#schema-basic.Heading) of level _N_.
//
// **`insertHorizontalRule`**`: MenuItem`
//   : A menu item to insert a horizontal rule.
//
// The return value also contains some prefabricated menu elements and
// menus, that you can use instead of composing your own menu from
// scratch:
//
// **`insertMenu`**`: Dropdown`
//   : A dropdown containing the `insertImage` and
//     `insertHorizontalRule` items.
//
// **`typeMenu`**`: Dropdown`
//   : A dropdown containing the items for making the current
//     textblock a paragraph, code block, or heading.
//
// **`fullMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the full menu
//     for, for example the [menu bar](https://github.com/prosemirror/prosemirror-menu#user-content-menubar).
function buildMenuItems(schema) {
  var r = {}, type
  if (type = schema.marks.strong)
    { r.toggleStrong = markItem(type, {title: "Toggle strong style", icon: icons.strong}) }
  if (type = schema.marks.em)
    { r.toggleEm = markItem(type, {title: "Toggle emphasis", icon: icons.em}) }
  if (type = schema.marks.code)
    { r.toggleCode = markItem(type, {title: "Toggle code font", icon: icons.code}) }
  if (type = schema.marks.link)
    { r.toggleLink = linkItem(type) }

  if (type = schema.nodes.image)
    { r.insertImage = insertImageItem(type) }
  if (type = schema.nodes.bullet_list)
    { r.wrapBulletList = wrapListItem(type, {
      title: "Wrap in bullet list",
      icon: icons.bulletList
    }) }
  if (type = schema.nodes.ordered_list)
    { r.wrapOrderedList = wrapListItem(type, {
      title: "Wrap in ordered list",
      icon: icons.orderedList
    }) }
  if (type = schema.nodes.blockquote)
    { r.wrapBlockQuote = wrapItem(type, {
      title: "Wrap in block quote",
      icon: icons.blockquote
    }) }
  if (type = schema.nodes.paragraph)
    { r.makeParagraph = blockTypeItem(type, {
      title: "Change to paragraph",
      label: "Plain"
    }) }
  if (type = schema.nodes.code_block)
    { r.makeCodeBlock = blockTypeItem(type, {
      title: "Change to code block",
      label: "Code"
    }) }
  if (type = schema.nodes.heading)
    { for (var i = 1; i <= 10; i++)
      { r["makeHead" + i] = blockTypeItem(type, {
        title: "Change to heading " + i,
        label: "Level " + i,
        attrs: {level: i}
      }) } }
  if (type = schema.nodes.horizontal_rule) {
    var hr = type
    r.insertHorizontalRule = new MenuItem({
      title: "Insert horizontal rule",
      label: "Horizontal rule",
      select: function select(state) { return canInsert(state, hr) },
      run: function run(state, dispatch) { dispatch(state.tr.replaceSelectionWith(hr.create())) }
    })
  }
  if (type = schema.nodes.table)
    { r.insertTable = insertTableItem(type) }
  if (type = schema.nodes.table_row) {
    r.addRowBefore = cmdItem(addRowBefore, {title: "Add row before"})
    r.addRowAfter = cmdItem(addRowAfter, {title: "Add row after"})
    r.removeRow = cmdItem(removeRow, {title: "Remove row"})
    r.addColumnBefore = cmdItem(addColumnBefore, {title: "Add column before"})
    r.addColumnAfter = cmdItem(addColumnAfter, {title: "Add column after"})
    r.removeColumn = cmdItem(removeColumn, {title: "Remove column"})
  }

  var cut = function (arr) { return arr.filter(function (x) { return x; }); }
  r.insertMenu = new Dropdown(cut([r.insertImage, r.insertHorizontalRule, r.insertTable]), {label: "Insert"})
  r.typeMenu = new Dropdown(cut([r.makeParagraph, r.makeCodeBlock, r.makeHead1 && new DropdownSubmenu(cut([
    r.makeHead1, r.makeHead2, r.makeHead3, r.makeHead4, r.makeHead5, r.makeHead6
  ]), {label: "Heading"})]), {label: "Type..."})
  var tableItems = cut([r.addRowBefore, r.addRowAfter, r.removeRow, r.addColumnBefore, r.addColumnAfter, r.removeColumn])
  if (tableItems.length)
    { r.tableMenu = new Dropdown(tableItems, {label: "Table"}) }

  r.inlineMenu = [cut([r.toggleStrong, r.toggleEm, r.toggleCode, r.toggleLink]) ]
  r.blockMenu = [cut([r.typeMenu, r.tableMenu, r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, joinUpItem,
                      liftItem, selectParentNodeItem])]
  r.fullMenu = r.inlineMenu.concat(r.blockMenu).concat([[undoItem, redoItem]])

  return r
}
exports.buildMenuItems = buildMenuItems
