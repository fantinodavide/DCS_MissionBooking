'use strict'
var assert = require('assert')
var fs = require('fs')
var luaParser = require('luaparse')

module.exports = function (lua) {
  return luaEval(luaParser.parse(lua))
}

function luaEval (ast, parentTable) {
  if (ast.type === 'Chunk') {
    var table = {}
    ast.body.forEach(function (chunk) {
      luaEval(chunk, table)
    })
    return table
  } else if (ast.type === 'AssignmentStatement') {
    assert(parentTable, "Can't have an assignment statement without a place to put it")
    for (var ii = 0; ii < ast.variables.length; ++ii) {
      var varInfo = ast.variables[ii]
      if (varInfo.type !== 'Identifier') {
        console.log('Unknown variable type:', varInfo)
        process.exit(1)
      }
      parentTable[varInfo.name] = luaEval(ast.init[ii])
    }
    return parentTable
  } else if (ast.type === 'TableConstructorExpression') {
    var table = {}
    ast.fields.forEach(function (chunk) {
      luaEval(chunk, table)
    })
    return table
  } else if (ast.type === 'TableKey') {
    assert(parentTable, "Can't have a table key without a table to put it in")
    parentTable[luaEval(ast.key)] = luaEval(ast.value)
    return parentTable
  } else if (/Literal$/.test(ast.type)) {
    return ast.value
  } else {
    console.log('Unknown type:', ast)
    process.exit(1)
  }
}
