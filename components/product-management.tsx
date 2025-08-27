"use client"

import type React from "react"

import { useState, useEffect, useCallback, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RotateCcw, Download, Plus, Minus, RotateCw, Search, Edit, X, Check } from "lucide-react"
import { canUseSupabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Product {
  id: string
  name: string
  description: string
  unit: string
}

interface Customer {
  id: string
  name: string
}

interface Warehouse {
  id: string
  name: string
}

interface ProductRow {
  id: string
  product: { id: string; name: string; unit: string }
  customer: { id: string; name: string }
  warehouse: { id: string; name: string }
  unit: string
  annual_volume: number
  monthly_sales: { [key: string]: number }
  monthly_shipments: { [key: string]: { shipment_number: string; quantity: number }[] }
  monthly_opening_stock: { [key: string]: number }
  monthly_closing_stock: { [key: string]: number }
  opening_stock: number
  closing_stock: number
  total_sales: number
  isEditing?: boolean
  isNew?: boolean
  rowType?: "regular" | "opening_stock"
}

export default function ProductManagement() {
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [undoStack, setUndoStack] = useState<ProductRow[][]>([])
  const [redoStack, setRedoStack] = useState<ProductRow[][]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [pageZoomLevel, setPageZoomLevel] = useState(100)
  const [tableZoomLevel, setTableZoomLevel] = useState(60)
  const selectedYear = new Date().getFullYear()
  const [editingCells, setEditingCells] = useState<Set<string>>(new Set())
  const [currentlyFocusedCell, setCurrentlyFocusedCell] = useState<{ rowIndex: number; field: string } | null>(null)

  const [duplicateAlert, setDuplicateAlert] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<{
    items: string[]
    field: string
    rowIndex: number
    show: boolean
    position: { top: number; left: number }
  }>({
    items: [],
    field: "",
    rowIndex: -1,
    show: false,
    position: { top: 0, left: 0 },
  })

  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  const [editingShipment, setEditingShipment] = useState<{
    rowIndex: number
    monthKey: string
    shipmentNumber: string
    quantity: string
    shipmentIndex?: number
  } | null>(null)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    rowIndex: number
    field: string
    monthKey?: string
  } | null>(null)

  const [cellFormatting, setCellFormatting] = useState<{
    [key: string]: { color: string; bold: boolean }
  }>({})

  const [newlyAddedRowIndex, setNewlyAddedRowIndex] = useState<number | null>(null)

  const months = [
    { key: "dec24", label: "Sales Dec 24", month: 12 },
    { key: "jan25", label: "Sales Jan 25", month: 1 },
    { key: "feb25", label: "Sales Feb 25", month: 2 },
    { key: "mar25", label: "Sales Mar 25", month: 3 },
    { key: "apr25", label: "Sales Apr 25", month: 4 },
    { key: "may25", label: "Sales May 25", month: 5 },
    { key: "jun25", label: "Sales Jun 25", month: 6 },
    { key: "jul25", label: "Sales Jul 25", month: 7 },
    { key: "aug25", label: "Sales Aug 25", month: 8 },
    { key: "sep25", label: "Sales Sep 25", month: 9 },
    { key: "oct25", label: "Sales Oct 25", month: 10 },
    { key: "nov25", label: "Sales Nov 25", month: 11 },
    { key: "dec25", label: "Sales Dec 25", month: 12 },
  ]

  const [filteredRows, setFilteredRows] = useState<ProductRow[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      setProductRows([])
      setCustomers([])
      setWarehouses([])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  useEffect(() => {
    // Apply search filter whenever searchQuery or productRows change
    const lowerSearchQuery = searchQuery.toLowerCase()
    const newFilteredRows = productRows.filter((row) => {
      if (!searchQuery.trim()) return true
      const lowerSearchQuery = searchQuery.toLowerCase()
      return (
        row.product?.name?.toLowerCase().includes(lowerSearchQuery) ||
        row.customer?.name?.toLowerCase().includes(lowerSearchQuery) ||
        row.warehouse?.name?.toLowerCase().includes(lowerSearchQuery)
      )
    })
    setFilteredRows(newFilteredRows)
  }, [searchQuery, productRows])

  const groupProductsByName = (rows: ProductRow[], updatedRowIndex: number, newProductName: string) => {
    if (!newProductName.trim()) return rows

    const updatedRow = { ...rows[updatedRowIndex], product: { ...rows[updatedRowIndex].product, name: newProductName } }
    const otherRows = rows.filter((_, index) => index !== updatedRowIndex)

    // Find if this product already exists (regardless of warehouse)
    const existingProductIndex = otherRows.findIndex(
      (row) => row.product.name.toLowerCase() === newProductName.toLowerCase(),
    )

    if (existingProductIndex === -1) {
      // Product doesn't exist, add at the end
      return [...otherRows, updatedRow]
    } else {
      // Product exists, find the last occurrence and insert after it
      let lastOccurrenceIndex = -1
      for (let i = otherRows.length - 1; i >= 0; i--) {
        if (otherRows[i].product.name.toLowerCase() === newProductName.toLowerCase()) {
          lastOccurrenceIndex = i
          break
        }
      }

      // Insert the updated row after the last occurrence
      const newRows = [...otherRows]
      newRows.splice(lastOccurrenceIndex + 1, 0, updatedRow)
      return newRows
    }
  }

  const groupProductsByNameAndWarehouse = (rows: ProductRow[], newProductName: string, targetWarehouse: string) => {
    if (!newProductName?.trim() || !targetWarehouse?.trim()) return rows

    const updatedRows = [...rows]
    const otherRows = updatedRows.slice()

    // Find if this product already exists (regardless of warehouse)
    const existingProductIndex = otherRows.findIndex(
      (row) => row?.product?.name?.toLowerCase() === newProductName.toLowerCase(),
    )

    if (existingProductIndex === -1) {
      return updatedRows
    }

    // Find the target position for the new entry
    let targetIndex = -1
    for (let i = 0; i < otherRows.length; i++) {
      const row = otherRows[i]
      if (!row?.product?.name || !row?.warehouse?.name) continue

      if (
        row.product.name.toLowerCase() === newProductName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === targetWarehouse.toLowerCase()
      ) {
        targetIndex = i + 1
        break
      }
    }

    if (targetIndex === -1) {
      // Find the last occurrence of this product name
      for (let i = otherRows.length - 1; i >= 0; i--) {
        const row = otherRows[i]
        if (row?.product?.name?.toLowerCase() === newProductName.toLowerCase()) {
          targetIndex = i + 1
          break
        }
      }
    }

    return updatedRows
  }

  const groupByWarehouseChange = (rows: ProductRow[], updatedRowIndex: number, newWarehouseName: string) => {
    if (!newWarehouseName.trim()) return rows

    const updatedRow = {
      ...rows[updatedRowIndex],
      warehouse: { ...rows[updatedRowIndex].warehouse, name: newWarehouseName },
    }
    const otherRows = rows.filter((_, index) => index !== updatedRowIndex)

    const productName = updatedRow.product.name

    // Find if this product-warehouse combination already exists
    const existingIndex = otherRows.findIndex(
      (row) =>
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === newWarehouseName.toLowerCase(),
    )

    if (existingIndex === -1) {
      return [...otherRows, updatedRow]
    } else {
      // Find the last occurrence and insert after it
      let lastOccurrenceIndex = -1
      for (let i = otherRows.length - 1; i >= 0; i--) {
        if (
          otherRows[i].product.name.toLowerCase() === productName.toLowerCase() &&
          otherRows[i].warehouse.name.toLowerCase() === newWarehouseName.toLowerCase()
        ) {
          lastOccurrenceIndex = i
          break
        }
      }

      const newRows = [...otherRows]
      newRows.splice(lastOccurrenceIndex + 1, 0, updatedRow)
      return newRows
    }
  }

  const groupRowsByProductWarehouse = useCallback((rows: ProductRow[]) => {
    if (!Array.isArray(rows)) {
      console.log("[v0] groupRowsByProductWarehouse called with non-array:", rows)
      return {}
    }

    return rows.reduce((groups: { [key: string]: ProductRow[] }, row) => {
      // Skip rows with undefined product or warehouse, but allow empty strings
      if (
        !row ||
        row.product === undefined ||
        row.warehouse === undefined ||
        row.product === null ||
        row.warehouse === null
      ) {
        console.log("[v0] Skipping row with undefined product or warehouse:", row)
        return groups
      }

      const productName = row.product.name || ""
      const warehouseName = row.warehouse.name || ""
      const key = `${productName}-${warehouseName}`

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(row)
      return groups
    }, {})
  }, [])

  const calculateConsolidatedStock = (groupRows: ProductRow[]) => {
    const consolidatedOpeningStock: { [key: string]: number } = {}
    const consolidatedClosingStock: { [key: string]: number } = {}

    months.forEach(({ key }) => {
      // Sum opening stock from all rows in the group with null checks
      consolidatedOpeningStock[key] = groupRows.reduce((sum, row) => {
        if (!row || !row.monthly_opening_stock) return sum
        return sum + (row.monthly_opening_stock[key] || 0)
      }, 0)

      // Sum closing stock from all rows in the group with null checks
      consolidatedClosingStock[key] = groupRows.reduce((sum, row) => {
        if (!row || !row.monthly_closing_stock) return sum
        return sum + (row.monthly_closing_stock[key] || 0)
      }, 0)
    })

    return { consolidatedOpeningStock, consolidatedClosingStock }
  }

  const updateGroupOpeningStock = (productName: string, warehouseName: string, monthKey: string, value: string) => {
    const numValue = Number.parseFloat(value) || 0

    const updatedRows = productRows.map((row) => {
      if (
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
      ) {
        return {
          ...row,
          monthly_opening_stock: {
            ...row.monthly_opening_stock,
            [monthKey]: numValue,
          },
        }
      }
      return row
    })

    // Recalculate closing stock for affected rows
    const calculateStockForRow = (rows: ProductRow[], rowIndex: number) => {
      const row = rows[rowIndex]

      // Calculate closing stock for each month and carry forward to next month
      months.forEach((month, index) => {
        const monthKey = month.key

        // Get values for calculation
        const openingStock = row.monthly_opening_stock[monthKey] || 0
        const sales = row.monthly_sales[monthKey] || 0

        // Calculate total shipment quantity for this month
        const shipments = row.monthly_shipments[monthKey] || []
        const totalShipmentQuantity = shipments.reduce((sum, shipment) => sum + shipment.quantity, 0)

        // Calculate closing stock: Opening Stock + Shipments - Sales
        const closingStock = openingStock + totalShipmentQuantity - sales
        row.monthly_closing_stock[monthKey] = closingStock

        // Carry forward closing stock to next month's opening stock
        if (index < months.length - 1) {
          const nextMonthKey = months[index + 1].key
          row.monthly_opening_stock[nextMonthKey] = closingStock
        }
      })
    }

    updatedRows.forEach((row, rowIndex) => {
      if (
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
      ) {
        calculateStockForRow(updatedRows, rowIndex)
      }
    })

    setProductRows(updatedRows)
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  useEffect(() => {
    // Auto-focus on the product name field of newly added rows
    if (newlyAddedRowIndex !== null) {
      // Set editing state for the product name cell
      const newEditingCells = new Set(editingCells)
      newEditingCells.add(`${newlyAddedRowIndex}-product.name`)
      setEditingCells(newEditingCells)
      setCurrentlyFocusedCell({ rowIndex: newlyAddedRowIndex, field: "product.name" })

      // Focus the input element after a short delay to ensure it's rendered
      setTimeout(() => {
        const inputElement = document.querySelector(
          `input[data-row="${newlyAddedRowIndex}"][data-field="product.name"]`,
        ) as HTMLInputElement
        if (inputElement) {
          inputElement.focus()
        }
      }, 100)

      // Reset the newly added row index
      setNewlyAddedRowIndex(null)
    }
  }, [newlyAddedRowIndex, editingCells])

  const saveToUndoStack = useCallback((currentRows: ProductRow[]) => {
    // Ensure currentRows is an array
    if (!Array.isArray(currentRows)) {
      console.log("[v0] saveToUndoStack called with non-array:", currentRows)
      return
    }

    setUndoStack((prevStack) => {
      if (prevStack.length >= 20) {
        console.log("[v0] Undo stack at maximum capacity, skipping save")
        return prevStack
      }

      if (prevStack.length > 0) {
        const lastSaved = prevStack[prevStack.length - 1]
        if (JSON.stringify(lastSaved) === JSON.stringify(currentRows)) {
          return prevStack // Skip duplicate without logging
        }
      }

      const newStack = [...prevStack, JSON.parse(JSON.stringify(currentRows))]
      console.log("[v0] Saved to undo stack, stack length:", newStack.length)
      return newStack
    })
  }, [])

  const calculateStockValues = useCallback((rows: ProductRow[]) => {
    // Ensure rows is an array before proceeding
    if (!Array.isArray(rows)) {
      console.log("[v0] calculateStockValues called with non-array:", rows)
      return []
    }

    const updatedRows = rows.map((row) => {
      // Skip calculation if essential data is missing, but allow empty strings
      if (
        !row ||
        !row.monthly_sales ||
        !row.monthly_shipments ||
        !row.monthly_opening_stock ||
        !row.monthly_closing_stock ||
        row.monthly_sales === undefined ||
        row.monthly_shipments === undefined ||
        row.monthly_opening_stock === undefined ||
        row.monthly_closing_stock === undefined
      ) {
        console.log("[v0] Skipping row with undefined monthly data:", row)
        return row
      }

      const updatedRow = { ...row }

      // Calculate monthly closing stock for each month
      months.forEach((month) => {
        const openingStock = updatedRow.monthly_opening_stock[month.key] || 0
        const sales = updatedRow.monthly_sales[month.key] || 0
        const shipments = updatedRow.monthly_shipments[month.key] || []
        const totalShipments = shipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)

        updatedRow.monthly_closing_stock[month.key] = openingStock + totalShipments - sales
      })

      return updatedRow
    })

    const finalRows = updatedRows.map((row) => {
      const updatedRow = { ...row }

      // Apply carryover logic: closing stock of current month becomes opening stock of next month
      for (let i = 0; i < months.length - 1; i++) {
        const currentMonth = months[i].key
        const nextMonth = months[i + 1].key
        const closingStock = updatedRow.monthly_closing_stock[currentMonth] || 0

        // Only update if the next month's opening stock is 0 or undefined (not manually set)
        if (!updatedRow.monthly_opening_stock[nextMonth]) {
          updatedRow.monthly_opening_stock[nextMonth] = closingStock

          // Recalculate closing stock for the next month after updating opening stock
          const nextMonthSales = updatedRow.monthly_sales[nextMonth] || 0
          const nextMonthShipments = updatedRow.monthly_shipments[nextMonth] || []
          const nextMonthTotalShipments = nextMonthShipments.reduce(
            (sum, shipment) => sum + (shipment.quantity || 0),
            0,
          )

          updatedRow.monthly_closing_stock[nextMonth] = closingStock + nextMonthTotalShipments - nextMonthSales
        }
      }

      return updatedRow
    })

    // Don't trigger undo save for automatic calculations
    setProductRows(finalRows)
    return finalRows
  }, [])

  const updateCellValue = useCallback(
    (rowIndex: number, field: string, value: string) => {
      const oldValue = productRows[rowIndex]?.[field as keyof ProductRow]

      // Only save to undo stack if value actually changed
      if (oldValue !== value) {
        saveToUndoStack(productRows)
      }

      const updatedRows = [...productRows]
      const row = updatedRows[rowIndex]

      if (!row) return

      if (field === "product.name") {
        row.product.name = value.toUpperCase()
        const groupedRows = groupProductsByNameAndWarehouse(updatedRows, value, row.warehouse.name)
        setProductRows(groupedRows)

        // Check for duplicates after a short delay to allow state to update
        setTimeout(() => {
          checkForDuplicates(value, row.customer.name, rowIndex)
        }, 100)
        return
      } else if (field === "customer.name") {
        row.customer.name = value
        checkForDuplicates(row.product.name, value, rowIndex)
        const groupedRows = groupProductsByNameAndWarehouse(updatedRows, row.product.name, row.warehouse.name)
        setProductRows(groupedRows)
        return
      } else if (field === "warehouse.name") {
        row.warehouse.name = value.toUpperCase()
        const groupedRows = groupProductsByNameAndWarehouse(updatedRows, row.product.name, value)
        setProductRows(groupedRows)
        return
      } else if (field.startsWith("monthly_sales.")) {
        const monthKey = field.split(".")[1]
        row.monthly_sales[monthKey] = Number.parseFloat(value) || 0
      } else if (field.startsWith("monthly_opening_stock.")) {
        const monthKey = field.split(".")[1]
        row.monthly_opening_stock[monthKey] = Number.parseFloat(value) || 0
      }

      setProductRows(updatedRows)

      if (field.startsWith("monthly_sales.") || field.startsWith("monthly_opening_stock.")) {
        // Use a single setTimeout to prevent multiple calculations
        setTimeout(() => {
          calculateStockValues(updatedRows)
        }, 50)
      }
    },
    [productRows, saveToUndoStack, calculateStockValues],
  )

  const getCurrentFieldValue = (rowIndex: number, field: string): string => {
    const row = productRows[rowIndex]
    if (!row) return ""

    if (field === "product.name") return row.product.name
    if (field === "customer.name") return row.customer.name
    if (field === "warehouse.name") return row.warehouse.name
    if (field === "annual_volume") return row.annual_volume.toString()
    if (field.startsWith("monthly_sales.")) {
      const monthKey = field.split(".")[1]
      return (row.monthly_sales[monthKey] || 0).toString()
    }
    return ""
  }

  const handleAddProduct = () => {
    const newProductId = `temp-${Date.now()}`
    const newRow: ProductRow = {
      id: newProductId,
      product: { id: newProductId, name: "", description: "", unit: "Kgs" },
      customer: { id: "", name: "" },
      warehouse: { id: "", name: "" },
      unit: "Kgs",
      annual_volume: 0,
      monthly_sales: {},
      monthly_shipments: {},
      monthly_opening_stock: {},
      monthly_closing_stock: {},
      opening_stock: 0,
      closing_stock: 0,
      total_sales: 0,
      isEditing: false,
      isNew: true,
    }

    saveToUndoStack(productRows)
    setProductRows([...productRows, newRow])

    // Auto-focus on the new row
    setNewlyAddedRowIndex(productRows.length)
  }

  const handleAddToColumn = (columnType: string, monthKey?: string) => {
    if (columnType === "customer.name") {
      console.log("[v0] Customer + button clicked")
      console.log("[v0] Currently focused cell:", currentlyFocusedCell)

      if (!currentlyFocusedCell || currentlyFocusedCell.field !== "product.name") {
        alert("Please click in a Product Name cell first, then click the + button for Customer Name.")
        return
      }

      const focusedRowIndex = currentlyFocusedCell.rowIndex
      const selectedRow = filteredRows[focusedRowIndex]
      console.log("[v0] Selected row data:", selectedRow)

      if (!selectedRow) {
        console.log("[v0] Selected row not found in filtered results")
        alert("Selected row not found. Please click in a Product Name cell again.")
        setCurrentlyFocusedCell(null)
        return
      }

      console.log("[v0] Creating new customer row for product:", selectedRow.product.name)

      const newRow: ProductRow = {
        id: `temp-${Date.now()}`,
        product: selectedRow.product, // Copy the same product
        customer: { id: "", name: "" }, // New empty customer
        warehouse: { id: "", name: "" }, // New empty warehouse
        unit: selectedRow.unit,
        annual_volume: 0,
        monthly_sales: {}, // Initialize empty monthly sales
        monthly_shipments: {}, // Initialize empty monthly shipments
        monthly_opening_stock: {}, // Initialize empty monthly opening stock
        monthly_closing_stock: {}, // Initialize empty monthly closing stock
        opening_stock: 0,
        closing_stock: 0,
        total_sales: 0,
        isEditing: false,
        isNew: true,
      }

      saveToUndoStack(productRows)
      const updatedRows = [...productRows, newRow]

      // Apply grouping to ensure proper positioning
      const groupedRows = groupProductsByNameAndWarehouse(updatedRows, selectedRow.product.name, "")
      setProductRows(groupedRows)

      // Apply calculations to the new row
      setTimeout(() => {
        calculateStockValues(groupedRows)
      }, 0)

      setCurrentlyFocusedCell(null)
    }
  }

  const isCellEditing = (rowIndex: number, field: string) => {
    return editingCells.has(`${rowIndex}-${field}`)
  }

  const stopCellEditing = (rowIndex: number, field: string) => {
    const newEditingCells = new Set(editingCells)
    newEditingCells.delete(`${rowIndex}-${field}`)
    setEditingCells(newEditingCells)
  }

  const stopAllCellEditing = () => {
    setEditingCells(new Set())
  }

  const toggleEdit = (rowIndex: number) => {
    const updatedRows = [...productRows]
    updatedRows[rowIndex].isEditing = !updatedRows[rowIndex].isEditing
    setProductRows(updatedRows)
  }

  const saveRow = (rowIndex: number) => {
    // Find the actual row in productRows that corresponds to the filtered row
    const rowToSave = filteredRows[rowIndex]
    const actualRowIndex = productRows.findIndex(row => 
      row.id === rowToSave.id || 
      (row.product.id === rowToSave.product.id && 
       row.customer.id === rowToSave.customer.id && 
       row.warehouse.id === rowToSave.warehouse.id)
    )
    
    if (actualRowIndex === -1) return
    
    const updatedRows = [...productRows]
    const row = updatedRows[actualRowIndex]
    row.isEditing = false
    row.isNew = false
    
    // If this row has a product name, reposition it to group with rows having the same product name
    if (row.product.name.trim()) {
      // Remove the row from its current position
      const rowToMove = updatedRows.splice(actualRowIndex, 1)[0]
      
      // Find the last row with the same product name
      let insertIndex = updatedRows.length // Default to end if no match found
      for (let i = updatedRows.length - 1; i >= 0; i--) {
        if (updatedRows[i].product.name.toLowerCase() === rowToMove.product.name.toLowerCase()) {
          insertIndex = i + 1
          break
        }
      }
      
      // Insert the row at the correct position
      updatedRows.splice(insertIndex, 0, rowToMove)
    }
    
    setProductRows(updatedRows)
    console.log("Saving row:", row)
  }

  const deleteRow = (rowIndex: number) => {
    console.log("[v0] Delete button clicked for row index:", rowIndex)

    saveToUndoStack(productRows)

    const rowToDelete = filteredRows[rowIndex]
    console.log("[v0] Row to delete:", rowToDelete)

    // Find the actual index in productRows array
    const actualIndex = productRows.findIndex((row, idx) => {
      // For new rows or rows with temporary IDs, use array index as fallback
      if (row.isNew || row.product.id.startsWith("temp-")) {
        return (
          idx ===
          productRows.findIndex(
            (pRow) =>
              pRow.product.name === rowToDelete.product.name &&
              pRow.customer.name === rowToDelete.customer.name &&
              pRow.warehouse.name === rowToDelete.warehouse.name,
          )
        )
      }
      // For existing rows, use ID matching
      return (
        row.product.id === rowToDelete.product.id &&
        row.customer.id === rowToDelete.customer.id &&
        row.warehouse.id === rowToDelete.warehouse.id
      )
    })

    console.log("[v0] Actual index to delete:", actualIndex)

    if (actualIndex !== -1) {
      const updatedRows = productRows.filter((_, idx) => idx !== actualIndex)
      setProductRows(updatedRows)
      console.log("[v0] Row deleted successfully")
    } else {
      console.log("[v0] Row not found for deletion")
    }
  }

  const handleAddSale = (productId: string, customerId: string, warehouseId: string, month: number) => {
    console.log(
      `Adding sale for Product: ${productId}, Customer: ${customerId}, Warehouse: ${warehouseId}, Month: ${month}`,
    )
  }

  const checkForDuplicates = useCallback(
    (productName: string, customerName: string, currentRowIndex: number) => {
      if (!productName?.trim() || !customerName?.trim()) return

      const duplicateExists = productRows.some((row, index) => {
        if (index === currentRowIndex) return false
        return (
          row?.product?.name?.toLowerCase().trim() === productName.toLowerCase().trim() &&
          row?.customer?.name?.toLowerCase().trim() === customerName.toLowerCase().trim()
        )
      })

      if (duplicateExists) {
        setDuplicateAlert(`Duplicate entry detected: ${productName} with customer ${customerName} already exists!`)
        setTimeout(() => setDuplicateAlert(""), 5000)
      }
    },
    [productRows],
  )

  const getSuggestions = (field: string, value: string) => {
    if (!Array.isArray(productRows)) {
      return []
    }

    let allValues: string[] = []
    if (field === "product.name") {
      allValues = [...new Set(productRows.map((row) => row?.product?.name).filter((name) => name?.trim()))]
    } else if (field === "customer.name") {
      allValues = [
        ...new Set([
          ...productRows.map((row) => row?.customer?.name).filter((name) => name?.trim()),
          ...customers.map((c) => c.name),
        ]),
      ]
    } else if (field === "warehouse.name") {
      allValues = [
        ...new Set([
          ...productRows.map((row) => row?.warehouse?.name).filter((name) => name?.trim()),
          ...warehouses.map((w) => w.name),
        ]),
      ]
    }

    const query = value
    return allValues.filter((value) => value?.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
  }

  const showSuggestions = (field: string, value: string, rowIndex: number, element: HTMLElement) => {
    const suggestionItems = getSuggestions(field, value)

    if (suggestionItems.length > 0) {
      const rect = element.getBoundingClientRect()
      setSuggestions({
        items: suggestionItems,
        field,
        rowIndex,
        show: true,
        position: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        },
      })
    } else {
      setSuggestions((prev) => ({ ...prev, show: false }))
    }
  }

  const hideSuggestions = () => {
    setTimeout(() => setSuggestions((prev) => ({ ...prev, show: false })), 150)
  }

  const selectSuggestion = (suggestion: string) => {
    updateCellValue(suggestions.rowIndex, suggestions.field, suggestion)
    setSuggestions((prev) => ({ ...prev, show: false }))

    // Check for duplicates after selecting suggestion
    if (suggestions.field === "product.name" || suggestions.field === "customer.name") {
      const row = productRows[suggestions.rowIndex]
      const productName = suggestions.field === "product.name" ? suggestion : row.product.name
      const customerName = suggestions.field === "customer.name" ? suggestion : row.customer.name
      checkForDuplicates(productName, customerName, suggestions.rowIndex)
    }
  }

  const startShipmentEdit = (rowIndex: number, monthKey: string) => {
    setEditingShipment({
      rowIndex,
      monthKey,
      shipmentNumber: "",
      quantity: "",
    })
  }

  const cancelShipmentEdit = () => {
    setEditingShipment(null)
  }

  const saveShipment = () => {
    if (!editingShipment) return

    const updatedRows = [...productRows]
    const actualRowIndex = productRows.findIndex(
      (row) =>
        row.product.id === filteredRows[editingShipment.rowIndex].product.id &&
        row.customer.id === filteredRows[editingShipment.rowIndex].customer.id &&
        row.warehouse.id === filteredRows[editingShipment.rowIndex].warehouse.id,
    )

    if (actualRowIndex === -1) return

    const row = updatedRows[actualRowIndex]
    const monthKey = editingShipment.monthKey
    const shipments = [...(row.monthly_shipments[monthKey] || [])]

    const shipmentData = {
      shipment_number: editingShipment.shipmentNumber,
      quantity: Number.parseFloat(editingShipment.quantity) || 0,
      formatting: { color: "black", bold: false },
    }

    if (editingShipment.shipmentIndex !== undefined) {
      shipments[editingShipment.shipmentIndex] = shipmentData
    } else {
      shipments.push(shipmentData)
    }

    row.monthly_shipments[monthKey] = shipments
    setProductRows(updatedRows)
    setEditingShipment(null)

    setTimeout(() => calculateStockValues(updatedRows), 50)
  }

  const editShipment = (rowIndex: number, monthKey: string, shipmentIndex: number) => {
    const row = filteredRows[rowIndex]
    const shipment = row.monthly_shipments[monthKey]?.[shipmentIndex]
    if (shipment) {
      setEditingShipment({
        rowIndex,
        monthKey,
        shipmentIndex,
        shipmentNumber: shipment.shipment_number,
        quantity: shipment.quantity.toString(),
      })
    }
  }

  const deleteShipment = (rowIndex: number, monthKey: string, shipmentIndex: number) => {
    saveToUndoStack(productRows)
    const updatedRows = [...productRows]
    const actualRowIndex = productRows.findIndex(
      (row) =>
        row.product.id === filteredRows[rowIndex].product.id &&
        row.customer.id === filteredRows[rowIndex].customer.id &&
        row.warehouse.id === filteredRows[rowIndex].warehouse.id,
    )

    if (actualRowIndex !== -1) {
      updatedRows[actualRowIndex].monthly_shipments[monthKey] =
        updatedRows[actualRowIndex].monthly_shipments[monthKey]?.filter((_, index) => index !== shipmentIndex) || []
      setProductRows(updatedRows)
    }
  }

  const handleRightClick = (e: React.MouseEvent, rowIndex: number, field: string, monthKey?: string) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      rowIndex,
      field,
      monthKey,
    })
  }

  const applyFormatting = (color: string, bold?: boolean) => {
    if (!contextMenu) return

    const cellKey = contextMenu.monthKey
      ? `${contextMenu.rowIndex}-${contextMenu.monthKey}`
      : `${contextMenu.rowIndex}-${contextMenu.field}`

    // Check if this is a shipment field
    if (contextMenu.field === "shipment" && contextMenu.monthKey) {
      const monthKey = contextMenu.monthKey
      const parts = monthKey.split("-")

      if (parts.length >= 3) {
        const baseKey = parts.slice(0, -1).join("-") // Remove the last part (number/quantity)
        const shipmentNumberKey = `${contextMenu.rowIndex}-${baseKey}-number`
        const shipmentQuantityKey = `${contextMenu.rowIndex}-${baseKey}-quantity`

        // Apply formatting to both shipment number and quantity
        setCellFormatting((prev) => ({
          ...prev,
          [shipmentNumberKey]: {
            color,
            bold: bold !== undefined ? bold : prev[shipmentNumberKey]?.bold || false,
          },
          [shipmentQuantityKey]: {
            color,
            bold: bold !== undefined ? bold : prev[shipmentQuantityKey]?.bold || false,
          },
        }))
      }
    } else if (contextMenu.field === "shipment-edit" && contextMenu.monthKey) {
      // Handle shipment editing fields
      const monthKey = contextMenu.monthKey
      const baseKey = monthKey.split("-")[0] // Get the month part
      const shipmentNumberKey = `${contextMenu.rowIndex}-${baseKey}-number`
      const shipmentQuantityKey = `${contextMenu.rowIndex}-${baseKey}-quantity`

      // Apply formatting to both shipment edit fields
      setCellFormatting((prev) => ({
        ...prev,
        [shipmentNumberKey]: {
          color,
          bold: bold !== undefined ? bold : prev[shipmentNumberKey]?.bold || false,
        },
        [shipmentQuantityKey]: {
          color,
          bold,
        },
      }))
    } else {
      // Regular field formatting
      setCellFormatting((prev) => ({
        ...prev,
        [cellKey]: {
          color,
          bold,
        },
      }))
    }
    setContextMenu(null)
  }

  const toggleBold = () => {
    if (!contextMenu) return

    const cellKey = contextMenu.monthKey
      ? `${contextMenu.rowIndex}-${contextMenu.monthKey}`
      : `${contextMenu.rowIndex}-${contextMenu.field}`

    // Check if this is a shipment field
    if (contextMenu.field === "shipment" && contextMenu.monthKey) {
      const monthKey = contextMenu.monthKey
      const parts = monthKey.split("-")

      if (parts.length >= 3) {
        const baseKey = parts.slice(0, -1).join("-") // Remove the last part (number/quantity)
        const shipmentNumberKey = `${contextMenu.rowIndex}-${baseKey}-number`
        const shipmentQuantityKey = `${contextMenu.rowIndex}-${baseKey}-quantity`

        // Get current bold state from either field
        const currentBold =
          cellFormatting[shipmentNumberKey]?.bold || cellFormatting[shipmentQuantityKey]?.bold || false

        // Toggle bold for both shipment number and quantity
        setCellFormatting((prev) => ({
          ...prev,
          [shipmentNumberKey]: {
            color: prev[shipmentNumberKey]?.color || "black",
            bold: !currentBold,
          },
          [shipmentQuantityKey]: {
            color: prev[shipmentQuantityKey]?.color || "black",
            bold: !currentBold,
          },
        }))
      }
    } else if (contextMenu.field === "shipment-edit" && contextMenu.monthKey) {
      // Handle shipment editing fields
      const monthKey = contextMenu.monthKey
      const baseKey = monthKey.split("-")[0] // Get the month part
      const shipmentNumberKey = `${contextMenu.rowIndex}-${baseKey}-number`
      const shipmentQuantityKey = `${contextMenu.rowIndex}-${baseKey}-quantity`

      // Get current bold state from either field
      const currentBold = cellFormatting[shipmentNumberKey]?.bold || cellFormatting[shipmentQuantityKey]?.bold || false

      // Toggle bold for both shipment edit fields
      setCellFormatting((prev) => ({
        ...prev,
        [shipmentNumberKey]: {
          color: prev[shipmentNumberKey]?.color || "black",
          bold: !currentBold,
        },
        [shipmentQuantityKey]: {
          color: prev[shipmentQuantityKey]?.color || "black",
          bold: !currentBold,
        },
      }))
    } else {
      // Regular field bold toggle
      setCellFormatting((prev) => ({
        ...prev,
        [cellKey]: {
          color: prev[cellKey]?.color || "black",
          bold: !prev[cellKey]?.bold,
        },
      }))
    }
    setContextMenu(null)
  }

  const getCellStyle = (rowIndex: number, field: string, monthKey?: string) => {
    const cellKey = monthKey ? `${rowIndex}-${monthKey}` : `${rowIndex}-${field}`
    const formatting = cellFormatting[cellKey]
    if (!formatting) return {}

    return {
      color: formatting.color,
      fontWeight: formatting.bold ? "bold" : "normal",
    }
  }

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const previousState = undoStack[undoStack.length - 1]
    setRedoStack([...redoStack, productRows])
    setProductRows(previousState)
    setUndoStack(undoStack.slice(0, -1))
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return
    const nextState = redoStack[redoStack.length - 1]
    setUndoStack([...undoStack, productRows])
    setProductRows(nextState)
    setRedoStack(redoStack.slice(0, -1))
  }

  const handleTabNavigation = (currentRowIndex: number, currentField: string, shiftKey: boolean) => {
    const fieldOrder = ["product.name", "customer.name", "warehouse.name", "unit", "annual_volume", ...monthKeys]
    const currentFieldIndex = fieldOrder.indexOf(currentField)

    if (currentFieldIndex === -1) return

    let nextFieldIndex: number
    let nextRowIndex = currentRowIndex

    if (shiftKey) {
      // Shift+Tab: Move backward
      nextFieldIndex = currentFieldIndex - 1
      if (nextFieldIndex < 0) {
        // Move to previous row, last field
        nextRowIndex = currentRowIndex - 1
        nextFieldIndex = fieldOrder.length - 1
      }
    } else {
      // Tab: Move forward
      nextFieldIndex = currentFieldIndex + 1
      if (nextFieldIndex >= fieldOrder.length) {
        // Move to next row, first field
        nextRowIndex = currentRowIndex + 1
        nextFieldIndex = 0
      }
    }

    // Check if the target row exists
    if (nextRowIndex < 0 || nextRowIndex >= filteredRows.length) return

    const nextField = fieldOrder[nextFieldIndex]

    // Stop current cell editing
    stopCellEditing(currentRowIndex, currentField)

    // Start editing the next cell
    setTimeout(() => {
      startCellEditing(nextRowIndex, nextField)
    }, 50)
  }

  const startCellEditing = (rowIndex: number, field: string) => {
    const newEditingCells = new Set(editingCells)
    newEditingCells.add(`${rowIndex}-${field}`)
    setEditingCells(newEditingCells)

    // Set focus to the input element after a short delay to ensure it's rendered
    setTimeout(() => {
      const inputElement = document.querySelector(
        `input[data-row="${rowIndex}"][data-field="${field}"], select[data-row="${rowIndex}"][data-field="${field}"]`,
      ) as HTMLInputElement | HTMLSelectElement
      if (inputElement) {
        inputElement.focus()
        if (inputElement instanceof HTMLInputElement) {
          inputElement.select() // Select all text for easier editing (only for input elements)
        }
      }
    }, 100)
  }

  const monthKeys = months.map((month) => `monthly_sales.${month.key}`)

  const getCellFormatting = (cellKey: string) => {
    return cellFormatting[cellKey]
  }

  const handleExportExcel = useCallback(() => {
    try {
      // Create CSV data as fallback that works in all environments
      const exportData = filteredRows.map((row, index) => {
        const rowData: any = {
          "S.No": index + 1,
          "Product Name": row.product.name || "",
          "Customer Name": row.customer.name || "",
          Warehouse: row.warehouse.name || "",
          Unit: row.product.unit || "",
          "Annual Volume": row.annual_volume || 0,
        }

        // Add monthly sales data
        const months = [
          "jan24",
          "feb24",
          "mar24",
          "apr24",
          "may24",
          "jun24",
          "jul24",
          "aug24",
          "sep24",
          "oct24",
          "nov24",
          "dec24",
        ]

        months.forEach((month) => {
          const monthName = month.charAt(0).toUpperCase() + month.slice(1, 3) + " " + month.slice(3)
          rowData[monthName] = row.monthly_sales?.[month] || 0
        })

        // Add total sales
        rowData["Total Sales"] = row.total_sales || 0

        return rowData
      })

      // Add stock summary data
      const groups = groupRowsByProductWarehouse(filteredRows)
      Object.entries(groups).forEach(([groupKey, groupRows]) => {
        const [productName, warehouseName] = groupKey.split("-")

        // Add opening stock row
        const openingStockRow: any = {
          "S.No": "",
          "Product Name": productName,
          "Customer Name": "OPENING STOCK",
          Warehouse: warehouseName,
          Unit: groupRows[0]?.product.unit || "",
          "Annual Volume": "",
        }

        const months = [
          "jan24",
          "feb24",
          "mar24",
          "apr24",
          "may24",
          "jun24",
          "jul24",
          "aug24",
          "sep24",
          "oct24",
          "nov24",
          "dec24",
        ]

        months.forEach((month) => {
          const monthName = month.charAt(0).toUpperCase() + month.slice(1, 3) + " " + month.slice(3)
          openingStockRow[monthName] = groupRows[0]?.monthly_opening_stock?.[month] || 0
        })

        exportData.push(openingStockRow)

        // Add shipments data
        const shipmentsRow: any = {
          "S.No": "",
          "Product Name": productName,
          "Customer Name": "SHIPMENTS",
          Warehouse: warehouseName,
          Unit: groupRows[0]?.product.unit || "",
          "Annual Volume": "",
        }

        months.forEach((month) => {
          const monthName = month.charAt(0).toUpperCase() + month.slice(1, 3) + " " + month.slice(3)
          const shipments = groupRows[0]?.monthly_shipments?.[month] || []
          const totalShipments = shipments.reduce((sum: number, shipment: any) => sum + (shipment.quantity || 0), 0)
          shipmentsRow[monthName] = totalShipments
        })

        exportData.push(shipmentsRow)

        // Add closing stock row
        const closingStockRow: any = {
          "S.No": "",
          "Product Name": productName,
          "Customer Name": "CLOSING STOCK",
          Warehouse: warehouseName,
          Unit: groupRows[0]?.product.unit || "",
          "Annual Volume": "",
        }

        months.forEach((month) => {
          const monthName = month.charAt(0).toUpperCase() + month.slice(1, 3) + " " + month.slice(3)
          closingStockRow[monthName] = groupRows[0]?.monthly_closing_stock?.[month] || 0
        })

        exportData.push(closingStockRow)
      })

      if (exportData.length === 0) {
        alert("No data to export")
        return
      }

      // Get headers from first row
      const headers = Object.keys(exportData[0])

      // Create CSV content
      const csvContent = [
        headers.join(","), // Header row
        ...exportData.map((row) =>
          headers
            .map((header) => {
              const value = row[header]
              // Escape commas and quotes in values
              if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`
              }
              return value
            })
            .join(","),
        ),
      ].join("\n")

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")

      // Generate filename with current date
      const now = new Date()
      const filename = `inventory_data_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}.csv`

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", filename)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      alert("Error exporting data. Please try again.")
    }
  }, [filteredRows, groupRowsByProductWarehouse])

  const handleSearchClick = () => {
    const query = prompt("Search by product / customer / warehouse:", searchQuery)
    if (query !== null) {
      setSearchQuery(query)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-black">Loading product data...</div>
      </div>
    )
  }

  return (
    <div style={{ transform: `scale(${pageZoomLevel / 100})`, transformOrigin: "top left" }}>
      <Card className="shadow-none border-none">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-black">Product Admin</h1>

            <div className="flex items-center gap-6">
              {/* Search and Actions Group */}
              <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-lg border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSearchClick}
                  className="hover:bg-white hover:shadow-sm transition-all"
                >
                  <Search className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-gray-300" />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>

              {/* Primary Action */}
              <Button
                size="sm"
                onClick={handleAddProduct}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all px-6"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>

              {/* Page Zoom Controls */}
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
                <span className="text-xs font-medium text-gray-600">Page</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPageZoomLevel(Math.max(50, pageZoomLevel - 10))}
                  className="h-7 w-7 p-0 hover:bg-white hover:shadow-sm transition-all"
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <div className="flex items-center gap-2">
                  <div
                    className="w-16 h-1.5 bg-gray-200 rounded-full relative cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const clickX = e.clientX - rect.left
                      const percentage = Math.max(50, Math.min(150, (clickX / rect.width) * 100 + 50))
                      setPageZoomLevel(Math.round(percentage))
                    }}
                  >
                    <div
                      className="h-1.5 bg-blue-500 rounded-full transition-all"
                      style={{ width: `${((pageZoomLevel - 50) / 100) * 100}%` }}
                    />
                    <div
                      className="absolute top-0 w-3 h-3 bg-blue-500 rounded-full transform -translate-y-0.5 cursor-grab active:cursor-grabbing shadow-sm"
                      style={{ left: `calc(${((pageZoomLevel - 50) / 100) * 100}% - 6px)` }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        const slider = e.currentTarget.parentElement
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const rect = slider!.getBoundingClientRect()
                          const moveX = moveEvent.clientX - rect.left
                          const percentage = Math.max(50, Math.min(150, (moveX / rect.width) * 100 + 50))
                          setPageZoomLevel(Math.round(percentage))
                        }
                        const handleMouseUp = () => {
                          document.removeEventListener("mousemove", handleMouseMove)
                          document.removeEventListener("mouseup", handleMouseUp)
                        }
                        document.addEventListener("mousemove", handleMouseMove)
                        document.addEventListener("mouseup", handleMouseUp)
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 min-w-[32px]">{pageZoomLevel}%</span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPageZoomLevel(Math.min(150, pageZoomLevel + 10))}
                  className="h-7 w-7 p-0 hover:bg-white hover:shadow-sm transition-all"
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPageZoomLevel(100)}
                  className="text-xs px-2 h-7 hover:bg-white hover:shadow-sm transition-all"
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* Search Query Display */}
            {searchQuery && (
              <div className="absolute top-20 right-6 flex items-center gap-1 px-3 py-1.5 bg-blue-100 border border-blue-200 rounded-lg text-sm shadow-sm">
                <Search className="h-3 w-3 text-blue-600" />
                <span className="text-blue-800">"{searchQuery}"</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="h-5 w-5 p-0 hover:bg-blue-200 ml-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {!canUseSupabase() && (
            <div className="border border-amber-200 bg-amber-50 p-4 rounded">
              <div className="text-black">
                <strong>Demo Mode:</strong> Supabase is not configured. Using mock data for demonstration. Please
                configure your environment variables in Project Settings to use live data.
              </div>
            </div>
          )}

          {duplicateAlert && (
            <div className="border border-red-200 bg-red-50 p-4 rounded">
              <div className="text-red-800 font-medium">⚠️ {duplicateAlert}</div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm text-black">Rows ({filteredRows.length})</span>
          </div>

          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border">
            <span className="text-sm font-medium text-gray-700">Table Zoom:</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTableZoomLevel(Math.max(20, tableZoomLevel - 10))}
              className="h-7 w-7 p-0 hover:bg-white hover:shadow-sm transition-all"
            >
              <Minus className="h-3 w-3" />
            </Button>

            <div
              className="w-20 h-1.5 bg-gray-200 rounded-full relative cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const percentage = Math.max(20, Math.min(100, (clickX / rect.width) * 100))
                setTableZoomLevel(Math.round(percentage))
              }}
            >
              <div className="h-1.5 bg-green-500 rounded-full transition-all" style={{ width: `${tableZoomLevel}%` }} />
              <div
                className="absolute top-0 w-3 h-3 bg-green-500 rounded-full transform -translate-y-0.5 cursor-grab active:cursor-grabbing shadow-sm"
                style={{ left: `calc(${tableZoomLevel}% - 6px)` }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  const slider = e.currentTarget.parentElement
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const rect = slider!.getBoundingClientRect()
                    const moveX = moveEvent.clientX - rect.left
                    const percentage = Math.max(20, Math.min(100, (moveX / rect.width) * 100))
                    setTableZoomLevel(Math.round(percentage))
                  }
                  const handleMouseUp = () => {
                    document.removeEventListener("mousemove", handleMouseMove)
                    document.removeEventListener("mouseup", handleMouseUp)
                  }
                  document.addEventListener("mousemove", handleMouseMove)
                  document.addEventListener("mouseup", handleMouseUp)
                }}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTableZoomLevel(Math.min(100, tableZoomLevel + 10))}
              className="h-7 w-7 p-0 hover:bg-white hover:shadow-sm transition-all"
            >
              <Plus className="h-3 w-3" />
            </Button>

            <span className="text-sm font-medium text-gray-700 min-w-[32px]">{tableZoomLevel}%</span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTableZoomLevel(60)}
              className="text-xs px-2 h-7 hover:bg-white hover:shadow-sm transition-all"
            >
              Reset
            </Button>
          </div>

          <div className="border border-gray-300 bg-white">
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse"
                style={{
                  transform: `scale(${tableZoomLevel / 100})`,
                  transformOrigin: "top left",
                  width: `${100 / (tableZoomLevel / 100)}%`,
                }}
              >
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                      <div className="flex items-center justify-center">
                        <span className="text-black font-medium">Product Name</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                          onClick={() => handleAddToColumn("product.name")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                      <div className="flex items-center justify-center">
                        <span className="text-black font-medium">Customer Name</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                          onClick={() => handleAddToColumn("customer.name")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[100px] bg-gray-100">
                      <div className="flex items-center justify-center">
                        <span className="text-black font-medium">Warehouse</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                          onClick={() => handleAddToColumn("warehouse.name")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[80px] text-black font-medium bg-gray-100">
                      Unit
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                      <div className="flex items-center justify-center">
                        <span className="text-black font-medium">Annual Volume</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                          onClick={() => handleAddToColumn("annual_volume")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                    {months.map(({ key, label }) => (
                      <th key={key} className="border border-gray-300 text-center p-2 min-w-[150px] bg-gray-100">
                        <div className="flex items-center justify-center">
                          <span className="text-black font-medium">{label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                            onClick={() => handleAddToColumn("monthly_sales", key)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </th>
                    ))}
                    <th className="border border-gray-300 text-center p-2 min-w-[100px] text-black font-medium bg-gray-100">
                      Total Sales
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[100px] text-black font-medium bg-gray-100">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={months.length + 6}
                        className="border border-gray-300 text-center p-8 text-black bg-white"
                      >
                        No products found. Click "Add Product" to create your first product entry.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const groups = groupRowsByProductWarehouse(filteredRows)
                      const result: ReactElement[] = []

                      Object.entries(groups).forEach(([groupKey, groupRows]) => {
                        const [productName, warehouseName] = groupKey.split("-")
                        const { consolidatedOpeningStock, consolidatedClosingStock } =
                          calculateConsolidatedStock(groupRows)

                        // Add regular rows for this group
                        groupRows.forEach((row, groupIndex) => {
                          const originalIndex = filteredRows.findIndex(
                            (r) =>
                              r.product.id === row.product.id &&
                              r.customer.id === row.customer.id &&
                              r.warehouse.id === row.warehouse.id,
                          )

                          result.push(
                            <tr
                              key={`${row.product.id}-${row.customer.id}-${row.warehouse.id}`}
                              className="bg-white hover:bg-gray-50"
                            >
                              {/* ... existing table row content ... */}
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "product.name") ? (
                                  <Input
                                    data-row={originalIndex}
                                    data-field="product.name"
                                    value={row.product.name}
                                    onChange={(e) => updateCellValue(originalIndex, "product.name", e.target.value)}
                                    onBlur={() => {
                                      stopCellEditing(originalIndex, "product.name")
                                      hideSuggestions()
                                    }}
                                    onFocus={(e) => {
                                      setCurrentlyFocusedCell({ rowIndex: originalIndex, field: "product.name" })
                                      if (e.target.value) {
                                        showSuggestions(
                                          "product.name",
                                          e.target.value,
                                          originalIndex,
                                          e.target as HTMLElement,
                                        )
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        stopCellEditing(originalIndex, "product.name")
                                        hideSuggestions()
                                      } else if (e.key === "Escape") {
                                        hideSuggestions()
                                      } else if (e.key === "Tab") {
                                        e.preventDefault()
                                        handleTabNavigation(originalIndex, "product.name", e.shiftKey)
                                        hideSuggestions()
                                      }
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "product.name")}
                                    style={getCellStyle(originalIndex, "product.name")}
                                    className="h-8 border-0 bg-transparent focus:ring-0 shadow-none outline-none p-1 text-center w-full uppercase font-bold"
                                    autoFocus={isCellEditing(originalIndex, "product.name")}
                                  />
                                ) : (
                                  <div
                                    className={`cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center uppercase font-bold ${
                                      currentlyFocusedCell?.rowIndex === originalIndex &&
                                      currentlyFocusedCell?.field === "product.name"
                                        ? "font-bold"
                                        : ""
                                    }`}
                                    style={getCellStyle(originalIndex, "product.name")}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-product.name`)
                                      setEditingCells(newEditingCells)
                                      setCurrentlyFocusedCell({ rowIndex: originalIndex, field: "product.name" })
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "product.name")}
                                  >
                                    {row.product.name || ""}
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "customer.name") ? (
                                  <Input
                                    data-row={originalIndex}
                                    data-field="customer.name"
                                    value={row.customer.name}
                                    onChange={(e) => updateCellValue(originalIndex, "customer.name", e.target.value)}
                                    onBlur={() => {
                                      stopCellEditing(originalIndex, "customer.name")
                                      hideSuggestions()
                                    }}
                                    onFocus={(e) => {
                                      if (e.target.value) {
                                        showSuggestions(
                                          "customer.name",
                                          e.target.value,
                                          originalIndex,
                                          e.target as HTMLElement,
                                        )
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        stopCellEditing(originalIndex, "customer.name")
                                        hideSuggestions()
                                      } else if (e.key === "Escape") {
                                        hideSuggestions()
                                      } else if (e.key === "Tab") {
                                        e.preventDefault()
                                        handleTabNavigation(originalIndex, "customer.name", e.shiftKey)
                                        hideSuggestions()
                                      }
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "customer.name")}
                                    style={getCellStyle(originalIndex, "customer.name")}
                                    className="h-8 border-0 bg-transparent focus:ring-0 shadow-none outline-none p-1 text-center w-full"
                                    autoFocus={isCellEditing(originalIndex, "customer.name")}
                                  />
                                ) : (
                                  <div
                                    className="cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center"
                                    style={getCellStyle(originalIndex, "customer.name")}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-customer.name`)
                                      setEditingCells(newEditingCells)
                                      setCurrentlyFocusedCell({ rowIndex: originalIndex, field: "customer.name" })
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "customer.name")}
                                  >
                                    {row.customer.name || ""}
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "warehouse.name") ? (
                                  <Input
                                    data-row={originalIndex}
                                    data-field="warehouse.name"
                                    value={row.warehouse.name}
                                    onChange={(e) => updateCellValue(originalIndex, "warehouse.name", e.target.value)}
                                    onBlur={() => {
                                      stopCellEditing(originalIndex, "warehouse.name")
                                      hideSuggestions()
                                    }}
                                    onFocus={(e) => {
                                      if (e.target.value) {
                                        showSuggestions(
                                          "warehouse.name",
                                          e.target.value,
                                          originalIndex,
                                          e.target as HTMLElement,
                                        )
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        stopCellEditing(originalIndex, "warehouse.name")
                                        hideSuggestions()
                                      } else if (e.key === "Escape") {
                                        hideSuggestions()
                                      } else if (e.key === "Tab") {
                                        e.preventDefault()
                                        handleTabNavigation(originalIndex, "warehouse.name", e.shiftKey)
                                        hideSuggestions()
                                      }
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "warehouse.name")}
                                    style={getCellStyle(originalIndex, "warehouse.name")}
                                    className="h-8 border-0 bg-transparent focus:ring-0 shadow-none outline-none p-1 text-center w-full uppercase font-bold"
                                    autoFocus={isCellEditing(originalIndex, "warehouse.name")}
                                  />
                                ) : (
                                  <div
                                    className="cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center uppercase font-bold"
                                    style={getCellStyle(originalIndex, "warehouse.name")}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-warehouse.name`)
                                      setEditingCells(newEditingCells)
                                      setCurrentlyFocusedCell({ rowIndex: originalIndex, field: "warehouse.name" })
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "warehouse.name")}
                                  >
                                    {row.warehouse.name || ""}
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "unit") ? (
                                  <Select
                                    value={row.unit}
                                    onValueChange={(value) => updateCellValue(originalIndex, "unit", value)}
                                  >
                                    <SelectTrigger className="h-8 border-0 bg-transparent focus:ring-0 shadow-none">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Kgs">Kgs</SelectItem>
                                      <SelectItem value="Lbs">Lbs</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div
                                    className="text-center cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center"
                                    onClick={() => {
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-unit`)
                                      setEditingCells(newEditingCells)
                                    }}
                                  >
                                    {row.unit}
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "annual_volume") ? (
                                  <Input
                                    data-row={originalIndex}
                                    data-field="annual_volume"
                                    type="number"
                                    value={row.annual_volume}
                                    onChange={(e) => updateCellValue(originalIndex, "annual_volume", e.target.value)}
                                    onBlur={() => stopCellEditing(originalIndex, "annual_volume")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        stopCellEditing(originalIndex, "annual_volume")
                                      } else if (e.key === "Tab") {
                                        e.preventDefault()
                                        handleTabNavigation(originalIndex, "annual_volume", e.shiftKey)
                                      }
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "annual_volume")}
                                    style={getCellStyle(originalIndex, "annual_volume")}
                                    className="h-8 border-0 bg-transparent focus:ring-0 shadow-none outline-none p-1 text-center w-full"
                                    autoFocus={isCellEditing(originalIndex, "annual_volume")}
                                  />
                                ) : (
                                  <div
                                    className="text-center cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center"
                                    style={getCellStyle(originalIndex, "annual_volume")}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "annual_volume")}
                                    onClick={() => {
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-annual_volume`)
                                      setEditingCells(newEditingCells)
                                    }}
                                  >
                                    {row.annual_volume.toLocaleString()}
                                  </div>
                                )}
                              </td>
                              {months.map(({ key }) => (
                                <td key={key} className="border border-gray-300 p-1 min-w-[150px] text-center">
                                  <div className="space-y-1">
                                    {/* Sales input */}
                                    <Input
                                      type="number"
                                      value={row.monthly_sales[key] || ""}
                                      onChange={(e) =>
                                        updateCellValue(originalIndex, `monthly_sales.${key}`, e.target.value)
                                      }
                                      className="w-full h-8 text-center border border-gray-300"
                                      style={getCellStyle(originalIndex, "monthly_sales", key)}
                                      onFocus={() =>
                                        setCurrentlyFocusedCell({
                                          rowIndex: originalIndex,
                                          field: `monthly_sales.${key}`,
                                        })
                                      }
                                      onBlur={() => stopCellEditing(originalIndex, `monthly_sales.${key}`)}
                                      onContextMenu={(e) => handleRightClick(e, originalIndex, "monthly_sales", key)}
                                      data-row={originalIndex}
                                      data-field={`monthly_sales.${key}`}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          stopCellEditing(originalIndex, `monthly_sales.${key}`)
                                        } else if (e.key === "Tab") {
                                          e.preventDefault()
                                          handleTabNavigation(originalIndex, `monthly_sales.${key}`, e.shiftKey)
                                        }
                                      }}
                                    />
                                  </div>
                                </td>
                              ))}
                              <td className="border border-gray-300 p-2 text-center bg-white">
                                {row.total_sales.toLocaleString()}
                              </td>
                              <td className="border border-gray-300 p-2 text-center bg-white">
                                <div className="flex gap-1 justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteRow(originalIndex)}
                                    className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                  {(row.isEditing || row.isNew) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => saveRow(originalIndex)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      Save
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>,
                          )
                        })

                        result.push(
                          // Opening Stock Row
                          <tr key={`${groupKey}-opening-stock`} className="bg-blue-50 border-t-2 border-blue-300">
                            <td className="border border-gray-300 p-2 font-semibold text-black">Opening Stock</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.product.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.warehouse.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }) => (
                              <td key={key} className="border border-gray-300 p-1 text-center">
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    value={consolidatedOpeningStock[key] || ""}
                                    onChange={(e) =>
                                      updateGroupOpeningStock(
                                        groupRows[0]?.product.name || "",
                                        groupRows[0]?.warehouse.name || "",
                                        key,
                                        e.target.value,
                                      )
                                    }
                                    className="w-full h-8 text-center border border-gray-300 bg-white"
                                  />
                                </div>
                              </td>
                            ))}
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>,

                          <tr key={`${groupKey}-shipments`} className="bg-orange-50 border-t border-orange-300">
                            <td className="border border-gray-300 p-2 font-semibold text-black">Shipments</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.product.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.warehouse.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }) => (
                              <td key={key} className="border border-gray-300 p-1 text-center">
                                <div className="space-y-1">
                                  {/* Display existing shipments */}
                                  {groupRows[0]?.monthly_shipments?.[key]?.map((shipment, shipmentIndex) => (
                                    <div key={shipmentIndex} className="flex items-center justify-between text-xs mt-1">
                                      <span
                                        className="cursor-pointer"
                                        onContextMenu={(e) =>
                                          handleRightClick(
                                            e,
                                            filteredRows.findIndex((r) => r === groupRows[0]),
                                            "shipment",
                                            `${key}-${shipmentIndex}-number`,
                                          )
                                        }
                                        style={getCellStyle(
                                          filteredRows.findIndex((r) => r === groupRows[0]),
                                          "shipment",
                                          `${key}-${shipmentIndex}-number`,
                                        )}
                                      >
                                        {shipment.shipment_number}
                                      </span>
                                      <span
                                        className="cursor-pointer"
                                        onContextMenu={(e) =>
                                          handleRightClick(
                                            e,
                                            filteredRows.findIndex((r) => r === groupRows[0]),
                                            "shipment",
                                            `${key}-${shipmentIndex}-quantity`,
                                          )
                                        }
                                        style={getCellStyle(
                                          filteredRows.findIndex((r) => r === groupRows[0]),
                                          "shipment",
                                          `${key}-${shipmentIndex}-quantity`,
                                        )}
                                      >
                                        {shipment.quantity}
                                      </span>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-4 w-4 p-0 text-blue-600 hover:text-blue-800"
                                          onClick={() =>
                                            editShipment(
                                              filteredRows.findIndex((r) => r === groupRows[0]),
                                              key,
                                              shipmentIndex,
                                            )
                                          }
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-4 w-4 p-0 text-red-600 hover:text-red-800"
                                          onClick={() =>
                                            deleteShipment(
                                              filteredRows.findIndex((r) => r === groupRows[0]),
                                              key,
                                              shipmentIndex,
                                            )
                                          }
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Shipment editing interface */}
                                  {editingShipment?.rowIndex === filteredRows.findIndex((r) => r === groupRows[0]) &&
                                    editingShipment?.monthKey === key && (
                                      <div className="space-y-1 mt-2 p-2 bg-white border border-orange-300 rounded">
                                        <Input
                                          type="text"
                                          placeholder="Shipment #"
                                          value={editingShipment.shipmentNumber}
                                          onChange={(e) =>
                                            setEditingShipment({
                                              ...editingShipment,
                                              shipmentNumber: e.target.value,
                                            })
                                          }
                                          className="w-full h-6 text-xs bg-white border border-gray-300"
                                          autoFocus
                                        />
                                        <Input
                                          type="number"
                                          placeholder="Quantity"
                                          value={editingShipment.quantity}
                                          onChange={(e) =>
                                            setEditingShipment({
                                              ...editingShipment,
                                              quantity: e.target.value,
                                            })
                                          }
                                          className="w-full h-6 text-xs bg-white border border-gray-300"
                                        />
                                        <div className="flex gap-1 justify-center">
                                          <Button
                                            size="sm"
                                            onClick={saveShipment}
                                            className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={cancelShipmentEdit}
                                            className="h-6 px-2 text-xs bg-transparent"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                  {/* Add shipment button */}
                                  {(!editingShipment ||
                                    editingShipment.rowIndex !== filteredRows.findIndex((r) => r === groupRows[0]) ||
                                    editingShipment.monthKey !== key) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        startShipmentEdit(
                                          filteredRows.findIndex((r) => r === groupRows[0]),
                                          key,
                                        )
                                      }
                                      className="w-full h-6 text-xs mt-1 border-orange-300 text-orange-700 hover:bg-orange-100"
                                    >
                                      + Shipment
                                    </Button>
                                  )}
                                </div>
                              </td>
                            ))}
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>,
                        )

                        result.push(
                          // Closing Stock Row
                          <tr key={`${groupKey}-closing-stock`} className="bg-green-50 border-b-4 border-red-500">
                            <td className="border border-gray-300 p-2 font-semibold text-black">Closing Stock</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.product.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.warehouse.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }) => (
                              <td key={key} className="border border-gray-300 p-1 text-center">
                                <div className="w-full h-8 text-center border border-gray-300 bg-gray-100 flex items-center justify-center font-medium">
                                  {consolidatedClosingStock[key]?.toLocaleString() || "0"}
                                </div>
                              </td>
                            ))}
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>,
                        )
                      })

                      return result
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-black">
            Totals by Product x Warehouse (customers combined)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                    <span className="text-black font-medium">Product</span>
                  </th>
                  <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                    <span className="text-black font-medium">Warehouse</span>
                  </th>
                  <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                    <span className="text-black font-medium">Unit</span>
                  </th>
                  <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                    <span className="text-black font-medium">Total Sales</span>
                  </th>
                  <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                    <span className="text-black font-medium">Entries</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  if (!Array.isArray(filteredRows)) {
                    return null
                  }

                  const productWarehouseTotals: { [key: string]: any } = {}

                  filteredRows.forEach((row) => {
                    if (!row?.product?.name || !row?.warehouse?.name) return

                    const key = `${row.product.name}-${row.warehouse.name}`
                    if (!productWarehouseTotals[key]) {
                      productWarehouseTotals[key] = {
                        productName: row.product.name,
                        warehouseName: row.warehouse.name,
                        unit: row.unit || "Kgs",
                        totalSales: 0,
                        entries: 0,
                      }
                    }

                    // Calculate total sales
                    if (row.monthly_sales) {
                      Object.values(row.monthly_sales).forEach((sales) => {
                        if (typeof sales === "number") {
                          productWarehouseTotals[key].totalSales += sales
                        }
                      })
                    }

                    productWarehouseTotals[key].entries += 1
                  })

                  const totalsArray = Object.values(productWarehouseTotals)
                  if (!Array.isArray(totalsArray)) {
                    return null
                  }

                  return totalsArray.map((totals, index) => (
                    <tr key={index} className="bg-white hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 bg-white text-black">{totals.productName}</td>
                      <td className="border border-gray-300 p-2 bg-white text-black">{totals.warehouseName}</td>
                      <td className="border border-gray-300 p-2 bg-white text-black">{totals.unit}</td>
                      <td className="border border-gray-300 p-2 bg-white text-black">
                        {totals.totalSales.toLocaleString()} {totals.unit.toLowerCase()}
                      </td>
                      <td className="border border-gray-300 p-2 bg-white text-black">{totals.entries}</td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {contextMenu && (
        <div
          className="absolute z-50 bg-white border border-gray-300 rounded shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
            onClick={() => applyFormatting("red")}
          >
            Red
          </button>
          <button
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
            onClick={() => applyFormatting("green")}
          >
            Green
          </button>
          <button
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
            onClick={() => applyFormatting("black")}
          >
            Black
          </button>
          <button
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
            onClick={() => toggleBold()}
          >
            Toggle Bold
          </button>
        </div>
      )}

      {suggestions.show && (
        <div
          className="absolute z-50 bg-white border border-gray-300 rounded shadow-md"
          style={{ top: suggestions.position.top, left: suggestions.position.left }}
        >
          {suggestions.items.map((item) => (
            <button
              key={item}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              onClick={() => selectSuggestion(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
