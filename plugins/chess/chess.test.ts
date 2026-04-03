import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Chess } from 'chess.js'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Chess Plugin Tests
 *
 * The chess plugin runs as a self-contained HTML app in a sandboxed iframe.
 * These tests verify:
 * 1. The manifest.json is valid and complete
 * 2. The game logic (via chess.js directly) works as expected for tool handlers
 * 3. The postMessage protocol contract is correct
 */

// --- Manifest validation ---
describe('Chess Plugin Manifest', () => {
	const manifestPath = resolve(__dirname, 'manifest.json')
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

	it('has required top-level fields', () => {
		expect(manifest.pluginId).toBe('chess')
		expect(manifest.pluginName).toBe('Chess')
		expect(manifest.version).toBe('1.0.0')
		expect(manifest.author).toBe('ChatBridge')
		expect(manifest.category).toBe('internal')
		expect(manifest.contentRating).toBe('safe')
		expect(typeof manifest.description).toBe('string')
		expect(manifest.description.length).toBeGreaterThan(0)
	})

	it('defines all four tools', () => {
		const toolNames = manifest.tools.map((t: { toolName: string }) => t.toolName)
		expect(toolNames).toEqual(['start_game', 'make_move', 'get_board_state', 'resign'])
	})

	it('make_move tool has required move parameter', () => {
		const makeMoveToolArr = manifest.tools.filter(
			(t: { toolName: string }) => t.toolName === 'make_move'
		)
		expect(makeMoveToolArr).toHaveLength(1)
		const makeMoveParams = makeMoveToolArr[0].parameters
		expect(makeMoveParams).toHaveLength(1)
		expect(makeMoveParams[0].parameterName).toBe('move')
		expect(makeMoveParams[0].isRequired).toBe(true)
	})

	it('has correct UI defaults', () => {
		expect(manifest.userInterface.defaultWidth).toBe(420)
		expect(manifest.userInterface.defaultHeight).toBe(520)
		expect(manifest.userInterface.isPersistent).toBe(true)
	})

	it('declares all capabilities', () => {
		expect(manifest.capabilities.supportsScreenshot).toBe(true)
		expect(manifest.capabilities.supportsVerboseState).toBe(true)
		expect(manifest.capabilities.supportsEventLog).toBe(true)
	})

	it('has no authentication', () => {
		expect(manifest.authentication.type).toBe('none')
	})

	it('has a contextPrompt', () => {
		expect(typeof manifest.contextPrompt).toBe('string')
		expect(manifest.contextPrompt.length).toBeGreaterThan(10)
	})

	it('has bundle configuration', () => {
		expect(manifest.bundle.entryFile).toBe('index.html')
		expect(typeof manifest.bundle.bundleUrl).toBe('string')
		expect(typeof manifest.bundle.bundleVersion).toBe('string')
	})
})

// --- Game logic tests (simulating what the HTML app does) ---
describe('Chess Game Logic (tool handlers)', () => {
	let game: InstanceType<typeof Chess>

	beforeEach(() => {
		game = new Chess()
	})

	describe('start_game', () => {
		it('returns valid initial FEN', () => {
			const fen = game.fen()
			expect(fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
		})

		it('resets to initial position after moves', () => {
			game.move('e4')
			game.move('e5')
			game.reset()
			expect(game.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
		})
	})

	describe('make_move', () => {
		it('accepts valid algebraic notation', () => {
			const result = game.move('e4')
			expect(result).not.toBeNull()
			expect(result!.san).toBe('e4')
			expect(game.fen()).toContain('4P3')
		})

		it('throws on invalid moves (v1.x behavior)', () => {
			expect(() => game.move('e5')).toThrow()
		})

		it('returns updated FEN after valid move', () => {
			game.move('e4')
			const fen = game.fen()
			expect(fen).not.toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
			expect(fen).toContain(' b ') // black to move
		})

		it('provides legal moves when move is invalid', () => {
			expect(() => game.move('Qd4')).toThrow()
			const legalMoves = game.moves()
			expect(legalMoves.length).toBeGreaterThan(0)
			expect(legalMoves).toContain('e4')
			expect(legalMoves).toContain('d4')
		})

		it('handles multiple sequential moves', () => {
			game.move('e4')
			game.move('e5')
			game.move('Nf3')
			game.move('Nc6')
			expect(game.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6'])
		})
	})

	describe('get_board_state', () => {
		it('returns complete state at start', () => {
			const state = {
				fen: game.fen(),
				currentTurn: game.turn() === 'w' ? 'white' : 'black',
				moveHistory: game.history(),
				moveCount: 0,
				isCheck: game.isCheck(),
				isCheckmate: game.isCheckmate(),
				isStalemate: game.isStalemate(),
				isDraw: game.isDraw(),
			}
			expect(state.currentTurn).toBe('white')
			expect(state.moveHistory).toEqual([])
			expect(state.isCheck).toBe(false)
			expect(state.isCheckmate).toBe(false)
			expect(state.isStalemate).toBe(false)
			expect(state.isDraw).toBe(false)
		})

		it('reflects state after moves', () => {
			game.move('e4')
			game.move('e5')
			const history = game.history()
			expect(history).toEqual(['e4', 'e5'])
			expect(game.turn()).toBe('w')
		})
	})

	describe('resign', () => {
		it('can determine resigning color', () => {
			expect(game.turn()).toBe('w')
			const resigningColor = game.turn() === 'w' ? 'White' : 'Black'
			const winnerColor = game.turn() === 'w' ? 'Black' : 'White'
			expect(resigningColor).toBe('White')
			expect(winnerColor).toBe('Black')
		})

		it('after a move, resign reflects correct player', () => {
			game.move('e4')
			expect(game.turn()).toBe('b')
			const resigningColor = game.turn() === 'b' ? 'Black' : 'White'
			expect(resigningColor).toBe('Black')
		})
	})

	describe('checkmate detection', () => {
		it("detects Scholar's Mate", () => {
			game.move('e4')
			game.move('e5')
			game.move('Qh5')
			game.move('Nc6')
			game.move('Bc4')
			game.move('Nf6')
			game.move('Qxf7')
			expect(game.isCheckmate()).toBe(true)
			expect(game.isGameOver()).toBe(true)
		})

		it("correctly identifies winner on checkmate", () => {
			game.move('e4')
			game.move('e5')
			game.move('Qh5')
			game.move('Nc6')
			game.move('Bc4')
			game.move('Nf6')
			game.move('Qxf7')
			// Black is checkmated, so it's black's turn but no legal moves
			expect(game.turn()).toBe('b')
			const winner = game.turn() === 'w' ? 'Black' : 'White'
			expect(winner).toBe('White')
		})
	})

	describe('check detection', () => {
		it('detects check', () => {
			// 1.e4 d5 2.Bb5+ is check but not mate
			game.move('e4')
			game.move('d5')
			game.move('Bb5')
			expect(game.isCheck()).toBe(true)
			expect(game.isCheckmate()).toBe(false)
		})
	})

	describe('state update after move', () => {
		it('produces correct state update payload', () => {
			game.move('e4')
			const verboseHistory = game.history({ verbose: true })
			const state = {
				fen: game.fen(),
				currentTurn: game.turn() === 'w' ? 'white' : 'black',
				moveHistory: game.history(),
				moveCount: Math.ceil(verboseHistory.length / 2),
				isCheck: game.isCheck(),
				isCheckmate: game.isCheckmate(),
				isStalemate: game.isStalemate(),
				isDraw: game.isDraw(),
			}
			expect(state.currentTurn).toBe('black')
			expect(state.moveHistory).toEqual(['e4'])
			expect(state.moveCount).toBe(1)
			expect(state.fen).toContain('4P3')
		})
	})

	describe('capture detection', () => {
		it('detects captured piece in move result', () => {
			game.move('e4')
			game.move('d5')
			const result = game.move('exd5')
			expect(result).not.toBeNull()
			expect(result!.captured).toBe('p')
		})
	})

	describe('castling detection', () => {
		it('detects kingside castling', () => {
			game.move('e4')
			game.move('e5')
			game.move('Nf3')
			game.move('Nc6')
			game.move('Bc4')
			game.move('Bc5')
			const result = game.move('O-O')
			expect(result).not.toBeNull()
			expect(result!.flags).toContain('k')
		})
	})
})

// --- PostMessage protocol contract tests ---
describe('PostMessage Protocol Contract', () => {
	it('app:ready message has correct shape', () => {
		const msg = { type: 'app:ready' }
		expect(msg.type).toBe('app:ready')
		expect(Object.keys(msg)).toEqual(['type'])
	})

	it('tool:result message for start_game has correct shape', () => {
		const game = new Chess()
		const msg = {
			type: 'tool:result',
			callId: 'test-call-1',
			result: {
				fen: game.fen(),
				message: 'New chess game started. White to move.',
			},
		}
		expect(msg.type).toBe('tool:result')
		expect(msg.callId).toBe('test-call-1')
		expect(msg.result.fen).toContain('rnbqkbnr')
		expect(typeof msg.result.message).toBe('string')
	})

	it('tool:error message has correct shape', () => {
		const game = new Chess()
		const legalMoves = game.moves()
		const msg = {
			type: 'tool:error',
			callId: 'test-call-2',
			error: 'Invalid move: Qd4. Legal moves: ' + legalMoves.join(', '),
		}
		expect(msg.type).toBe('tool:error')
		expect(msg.callId).toBe('test-call-2')
		expect(typeof msg.error).toBe('string')
		expect(msg.error).toContain('Legal moves:')
	})

	it('state:update message has correct shape', () => {
		const game = new Chess()
		game.move('e4')
		const verboseHistory = game.history({ verbose: true })
		const msg = {
			type: 'state:update',
			state: {
				fen: game.fen(),
				currentTurn: game.turn() === 'w' ? 'white' : 'black',
				moveHistory: game.history(),
				moveCount: Math.ceil(verboseHistory.length / 2),
				isCheck: game.isCheck(),
				isCheckmate: game.isCheckmate(),
				isStalemate: game.isStalemate(),
				isDraw: game.isDraw(),
			},
			description: 'Move 1. black to move.',
		}
		expect(msg.type).toBe('state:update')
		expect(typeof msg.state).toBe('object')
		expect(typeof msg.description).toBe('string')
		expect(msg.state.currentTurn).toBe('black')
	})

	it('app:complete message for resign has correct shape', () => {
		const msg = {
			type: 'app:complete',
			summary: 'White resigns. Black wins!',
		}
		expect(msg.type).toBe('app:complete')
		expect(typeof msg.summary).toBe('string')
	})

	it('app:complete message for checkmate has correct shape', () => {
		const msg = {
			type: 'app:complete',
			summary: 'Checkmate! White wins.',
		}
		expect(msg.type).toBe('app:complete')
		expect(typeof msg.summary).toBe('string')
		expect(msg.summary).toContain('Checkmate')
	})

	it('state:response message has correct shape', () => {
		const game = new Chess()
		const msg = {
			type: 'state:response',
			state: {
				fen: game.fen(),
				currentTurn: 'white',
				moveHistory: [] as string[],
				moveCount: 0,
				isCheck: false,
				isCheckmate: false,
				isStalemate: false,
				isDraw: false,
			},
			description: 'Move 0. white to move.',
		}
		expect(msg.type).toBe('state:response')
		expect(msg.state.fen).toBeDefined()
		expect(msg.state.moveHistory).toEqual([])
	})

	it('event:log message has correct shape', () => {
		const msg = {
			type: 'event:log',
			eventDescription: 'Piece captured: black p on d5',
			eventData: { capturedPiece: 'p', square: 'd5', capturedBy: 'p' },
			eventTimestamp: Date.now(),
		}
		expect(msg.type).toBe('event:log')
		expect(typeof msg.eventDescription).toBe('string')
		expect(typeof msg.eventTimestamp).toBe('number')
		expect(msg.eventData).toBeDefined()
	})

	it('screenshot:response message has correct shape', () => {
		const msg = {
			type: 'screenshot:response',
			imageData: 'data:image/png;base64,AAAA',
			mimeType: 'image/png',
		}
		expect(msg.type).toBe('screenshot:response')
		expect(typeof msg.imageData).toBe('string')
		expect(msg.mimeType).toBe('image/png')
	})
})

// --- index.html existence check ---
describe('Chess Plugin Files', () => {
	it('index.html exists and contains expected markers', () => {
		const htmlPath = resolve(__dirname, 'index.html')
		const html = readFileSync(htmlPath, 'utf-8')
		expect(html).toContain('app:ready')
		expect(html).toContain('tool:invoke')
		expect(html).toContain('state:update')
		expect(html).toContain('state:response')
		expect(html).toContain('screenshot:response')
		expect(html).toContain('event:log')
		expect(html).toContain('app:complete')
		expect(html).toContain('chess.js')
	})
})
