import express from 'express'
import { db, client } from '../db/config.js'
import { requirements } from '../db/schema.js'
import { eq, asc, sql } from 'drizzle-orm'

const router = express.Router()

// Get all requirements
router.get('/', async (req, res) => {
  try {
    // Use direct postgres client to bypass Drizzle schema mapping issues
    const allRequirements = await client`
      SELECT id, description, created_at as "createdAt"
      FROM requirements
      ORDER BY id ASC
    `
    
    res.json({ success: true, requirements: allRequirements })
  } catch (error) {
    console.error('Error fetching requirements:', error)
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      severity: error.severity
    })
    
    res.status(500).json({ success: false, message: 'Failed to fetch requirements', error: error.message, code: error.code })
  }
})

// Get single requirement
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await client`
      SELECT id, description, created_at as "createdAt"
      FROM requirements
      WHERE id = ${parseInt(id)}
      LIMIT 1
    `
    
    const requirement = result[0]

    if (!requirement) {
      return res.status(404).json({ success: false, message: 'Requirement not found' })
    }

    res.json({ success: true, requirement })
  } catch (error) {
    console.error('Error fetching requirement:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch requirement', error: error.message })
  }
})

// Create new requirement
router.post('/', async (req, res) => {
  try {
    const { description } = req.body

    if (!description) {
      return res.status(400).json({ success: false, message: 'Description is required' })
    }

    const result = await client`
      INSERT INTO requirements (description)
      VALUES (${description})
      RETURNING id, description, created_at as "createdAt"
    `
    
    const requirement = result[0]

    res.json({ success: true, requirement })
  } catch (error) {
    console.error('Error creating requirement:', error)
    res.status(500).json({ success: false, message: 'Failed to create requirement', error: error.message })
  }
})

export default router
