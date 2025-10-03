"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Filter, Calendar } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

interface Product {
  id: string
  name: string
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

interface Sale {
  id: string
  product_id: string
  customer_id: string
  warehouse_id: string
  month: number
  year: number
  quantity: number
  unit: string
  created_at: string
  product: Product
  customer: Customer
  warehouse: Warehouse
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function SalesManagement() {
  console.log('[SalesManagement] Component is rendering!')
  const [sales, setSales] = useState<Sale[]>([])
  const [stockRecords, setStockRecords] = useState<any[]>([])
  const [shipments, setShipments] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isSaleDialogOpen, setIsSaleDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Pending inline edits and debounced save timers
  const [pendingQuantities, setPendingQuantities] = useState<Record<string, number>>({})
  const [pendingStockCalculations, setPendingStockCalculations] = useState<Record<string, number>>({})
  const saveTimersRef = useRef<Record<string, NodeJS.Timeout>>({})

  // Filter states
  const [filters, setFilters] = useState({
    month: "",
    year: new Date().getFullYear().toString(),
    product_id: "",
    customer_id: "",
    warehouse_id: "",
  })

  // Form states
  const [saleForm, setSaleForm] = useState({
    product_id: "",
    customer_id: "",
    warehouse_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    quantity: "",
    unit: "Kgs",
  })

  // Treat "0" (from Select's All option), empty string, null or undefined as "All" (no filter)
  const isAllValue = (value: unknown) => value === "0" || value === "" || value === undefined || value === null || value === 0

  // Base year to anchor cross-year view (Dec of previous year + Jan..May of base year)
  const getBaseYear = () => Number.parseInt(filters.year) || new Date().getFullYear()
  const getDisplayYearForMonth = (month: number) => (month === 12 ? getBaseYear() - 1 : getBaseYear())

  const buildSaleKey = (
    productId: string,
    customerId: string,
    warehouseId: string,
    month: number,
    year: number
  ) => `${productId}|${customerId}|${warehouseId}|${month}|${year}`

  const calculateImmediateClosingStock = (
    productId: string,
    warehouseId: string,
    month: number,
    year: number,
    newSalesQuantity: number,
    customerId: string
  ) => {
    // Get current opening stock for this month
    const stockRecord = stockRecords.find(s => 
      s.product.id === productId && 
      s.warehouse.id === warehouseId && 
      s.month === month &&
      s.year === year
    )
    
    if (!stockRecord) return -newSalesQuantity // If no opening stock record, assume 0 opening
    
    // Get all sales for this product-warehouse-month
    const existingSales = sales.filter(s => 
      s.product_id === productId &&
      s.warehouse_id === warehouseId &&
      s.month === month &&
      s.year === year
    )
    
    // Calculate total sales, replacing the current customer's sale with the new quantity
    let totalSales = 0
    let foundCurrentCustomerSale = false
    
    existingSales.forEach(sale => {
      if (sale.customer_id === customerId) {
        totalSales += newSalesQuantity // Use new quantity for this customer
        foundCurrentCustomerSale = true
      } else {
        totalSales += sale.quantity // Keep existing quantities for other customers
      }
    })
    
    // If this is a new sale for this customer, add it
    if (!foundCurrentCustomerSale) {
      totalSales += newSalesQuantity
    }
    
    // Get shipments (assume 0 for now since we don't have shipment data in this context)
    // Note: Direct shipments are already excluded from stock calculations
    const totalShipments = 0
    
    const calculatedClosing = stockRecord.opening_stock + totalShipments - totalSales
    console.log(`[Immediate Calc] ${month}/${year}: Opening=${stockRecord.opening_stock}, Shipments=${totalShipments}, Sales=${totalSales}, Closing=${calculatedClosing}`)
    
    return calculatedClosing
  }

  const scheduleSaveQuantity = (
    productId: string,
    customerId: string,
    warehouseId: string,
    unit: string,
    month: number,
    year: number,
    quantity: number
  ) => {
    const key = buildSaleKey(productId, customerId, warehouseId, month, year)
    const stockKey = `stock-${productId}-${warehouseId}-${month}-${year}`

    // Update local pending state immediately for snappy UI
    setPendingQuantities((prev) => ({ ...prev, [key]: quantity }))
    
    // Calculate and store immediate closing stock
    const immediateClosingStock = calculateImmediateClosingStock(productId, warehouseId, month, year, quantity, customerId)
    setPendingStockCalculations((prev) => ({ ...prev, [stockKey]: immediateClosingStock }))

    // Debounce the actual DB write
    const timers = saveTimersRef.current
    if (timers[key]) clearTimeout(timers[key])
    timers[key] = setTimeout(async () => {
      try {
        // Check if sale exists
        const existing = sales.find(
          (s) =>
            s.product_id === productId &&
            s.customer_id === customerId &&
            s.warehouse_id === warehouseId &&
            s.month === month &&
            s.year === year
        )

        if (existing) {
          await handleUpdateSaleDirect({ ...existing, quantity })
        } else {
          await handleCreateSaleDirect({
            product_id: productId,
            customer_id: customerId,
            warehouse_id: warehouseId,
            month,
            year,
            quantity,
            unit,
          })
        }
      } finally {
        // Clear pending states so we display server values afterwards
        setPendingQuantities((prev) => {
          const { [key]: _, ...rest } = prev
          return rest
        })
        
        // Delay clearing stock calculations to prevent flicker
        setTimeout(() => {
          setPendingStockCalculations((prev) => {
            const { [stockKey]: _, ...rest } = prev
            return rest
          })
        }, 2000) // Give extra time for stock calculations to complete
        // Remove timer ref
        delete saveTimersRef.current[key]
      }
    }, 500)
  }

  useEffect(() => {
    console.log('[SalesManagement] Component mounted, fetching data...')
    fetchData()
  }, [])

  useEffect(() => {
    console.log('[SalesManagement] Filters changed, refetching data...', filters)
    fetchFilteredSales()
    fetchStockRecords()
    fetchShipments()
  }, [filters])

  // Listen for stock data updates
  useEffect(() => {
    const handleStockDataUpdate = () => {
      console.log('[SalesManagement] Stock data updated, refreshing stock records...')
      fetchStockRecords()
    }
    
    window.addEventListener('stockDataUpdate', handleStockDataUpdate)
    
    return () => {
      window.removeEventListener('stockDataUpdate', handleStockDataUpdate)
    }
  }, [])

  // Auto-refresh stock records when sales change (but don't clear pending calculations)
  useEffect(() => {
    if (sales.length > 0) {
      console.log('[SalesManagement] Sales data changed, refreshing stock records...')
      // Don't refresh immediately if we have pending calculations
      const hasPendingCalculations = Object.keys(pendingStockCalculations).length > 0
      if (!hasPendingCalculations) {
        fetchStockRecords()
      }
    }
  }, [sales, pendingStockCalculations])

  // Recalculate all stock records when component loads
  useEffect(() => {
    if (sales.length > 0 && stockRecords.length > 0) {
      console.log('[SalesManagement] Recalculating all stock records on load...')
      recalculateAllStockRecords()
    }
  }, [sales, stockRecords])

  // Force recalculation for WOODS warehouse if needed
  useEffect(() => {
    const woodsSales = sales.filter(s => s.warehouse.name === 'WOODS')
    if (woodsSales.length > 0) {
      console.log('[SalesManagement] Found WOODS sales, forcing recalculation...')
      console.log('[SalesManagement] WOODS sales:', woodsSales)
      
      // Force immediate recalculation for WOODS
      setTimeout(() => {
        woodsSales.forEach(sale => {
          console.log('[SalesManagement] Processing WOODS sale:', sale)
          updateStockRecordsForSale(sale)
        })
        
        // Force stock records refresh after processing
        setTimeout(() => {
          console.log('[SalesManagement] Refreshing stock records after WOODS processing...')
          fetchStockRecords()
        }, 1000)
      }, 100)
    }
  }, [sales])

  // Function to determine if a warehouse is a direct shipment based on name patterns
  const isDirectShipment = (warehouseName: string): boolean => {
    if (!warehouseName) return true // Empty warehouse names are considered direct shipments
    
    const lowerName = warehouseName.toLowerCase()
    
    // Special case: WOODS is NEVER a direct shipment
    if (lowerName === 'woods') {
      console.log('[SalesManagement] WOODS detected - NOT a direct shipment')
      return false
    }
    
    // Check for exact matches or word boundaries to avoid false positives
    const directShipmentPatterns = [
      /\bdirect\b/,
      /\bshipment\b/,
      /\bdirect\s+shipment\b/,
      /\bdirect\s+ship\b/,
      /\bds\b/,  // Only match DS as a separate word, not within other words
      /\bdirects\b/
    ]
    
    const isDirect = directShipmentPatterns.some(pattern => pattern.test(lowerName))
    console.log(`[SalesManagement] Warehouse "${warehouseName}" isDirectShipment: ${isDirect}`)
    return isDirect
  }

  // Function to group sales by product-warehouse combinations
  const groupSalesByProductWarehouse = (sales: Sale[]): { [key: string]: Sale[] } => {
    const grouped: { [key: string]: Sale[] } = {}
    
    sales.forEach(sale => {
      const key = `${sale.product.name}|${sale.warehouse.name}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(sale)
    })
    
    // Sort each group by month and year
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })
    })
    
    return grouped
  }

  // Function to sort sales by product name, then by warehouse type (regular warehouses first, then direct shipments)
  const sortSalesByProductAndWarehouseType = (sales: Sale[]): Sale[] => {
    const sorted = [...sales].sort((a, b) => {
      // First, sort by product name
      const productComparison = a.product.name.localeCompare(b.product.name)
      if (productComparison !== 0) {
        return productComparison
      }
      
      // For same product, sort by warehouse type (regular warehouses first)
      const aIsDirect = isDirectShipment(a.warehouse.name)
      const bIsDirect = isDirectShipment(b.warehouse.name)
      
      // Regular warehouses (false) come before direct shipments (true)
      if (aIsDirect !== bIsDirect) {
        return aIsDirect ? 1 : -1
      }
      
      // If both are same type, sort by warehouse name
      const warehouseComparison = a.warehouse.name.localeCompare(b.warehouse.name)
      if (warehouseComparison !== 0) {
        return warehouseComparison
      }
      
      // Finally, sort by creation date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    
    return sorted
  }

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, unit")
        .order("name")

      if (productsError) throw productsError
      setProducts(productsData || [])

      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, name")
        .order("name")

      if (customersError) throw customersError
      setCustomers(customersData || [])

      // Fetch warehouses
      const { data: warehousesData, error: warehousesError } = await supabase
        .from("warehouses")
        .select("id, name")
        .order("name")

      if (warehousesError) throw warehousesError
      setWarehouses(warehousesData || [])

      // Initial sales fetch
      await fetchFilteredSales()
      
      // Fetch stock records
      await fetchStockRecords()
      
      // Fetch shipments
      await fetchShipments()
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFilteredSales = async () => {
    try {
      console.log('[SalesManagement] Fetching sales data...')
      
      let query = supabase
        .from("sales")
        .select(`
          *,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)
        .order("created_at", { ascending: false })

      // Apply filters
      if (!isAllValue(filters.year)) {
        query = query.eq("year", Number.parseInt(filters.year))
      }
      if (!isAllValue(filters.month)) {
        query = query.eq("month", Number.parseInt(filters.month))
      }
      if (!isAllValue(filters.product_id)) {
        query = query.eq("product_id", filters.product_id)
      }
      if (!isAllValue(filters.customer_id)) {
        query = query.eq("customer_id", filters.customer_id)
      }
      if (!isAllValue(filters.warehouse_id)) {
        query = query.eq("warehouse_id", filters.warehouse_id)
      }

      const { data, error } = await query

      if (error) throw error
      
      console.log('[SalesManagement] Raw sales data:', data)
      console.log('[SalesManagement] Number of sales records:', data?.length || 0)
      
      // Sort sales to prioritize regular warehouses over direct shipments for same products
      const sortedSales = sortSalesByProductAndWarehouseType(data || [])
      console.log('[SalesManagement] Sorted sales:', sortedSales)
      setSales(sortedSales)
    } catch (error) {
      console.error("Error fetching sales:", error)
    }
  }

  const fetchStockRecords = async () => {
    try {
      let query = supabase
        .from("stock_records")
        .select(`
          *,
          product:products(id, name, unit),
          warehouse:warehouses(id, name)
        `)
        .order("created_at", { ascending: false })

      // Apply filters
      if (!isAllValue(filters.year)) {
        query = query.eq("year", Number.parseInt(filters.year))
      }
      if (!isAllValue(filters.month)) {
        query = query.eq("month", Number.parseInt(filters.month))
      }
      if (!isAllValue(filters.product_id)) {
        query = query.eq("product_id", filters.product_id)
      }
      if (!isAllValue(filters.warehouse_id)) {
        query = query.eq("warehouse_id", filters.warehouse_id)
      }

      const { data, error } = await query

      if (error) throw error
      setStockRecords(data || [])
      
      // Auto-create missing stock records for existing sales
      await ensureStockRecordsExist()
    } catch (error) {
      console.error("Error fetching stock records:", error)
    }
  }

  // Function to ensure stock records exist for all product-warehouse combinations in sales
  const ensureStockRecordsExist = async () => {
    try {
      const uniqueCombinations = new Set<string>()
      
      // Get all unique product-warehouse combinations from sales
      sales.forEach(sale => {
        const key = `${sale.product_id}-${sale.warehouse_id}`
        uniqueCombinations.add(key)
      })
      
      console.log('[SalesManagement] Found unique combinations:', Array.from(uniqueCombinations))
      
      for (const combination of uniqueCombinations) {
        const [productId, warehouseId] = combination.split('-')
        
        // Check if stock records exist for this combination
        const { data: existingRecords, error: checkError } = await supabase
          .from("stock_records")
          .select("id")
          .eq("product_id", productId)
          .eq("warehouse_id", warehouseId)
          .eq("year", Number.parseInt(filters.year) || new Date().getFullYear())
        
        if (checkError) {
          console.error("Error checking existing stock records:", checkError)
          continue
        }
        
        // If no records exist, create them for all months
        if (!existingRecords || existingRecords.length === 0) {
          console.log(`[SalesManagement] Creating stock records for product ${productId} - warehouse ${warehouseId}`)
          
          const stockRecordsToCreate = [12, 1, 2, 3, 4, 5].map(month => ({
            product_id: productId,
            warehouse_id: warehouseId,
            month: month,
            year: Number.parseInt(filters.year) || new Date().getFullYear(),
            opening_stock: 0,
            closing_stock: 0,
            unit: "Kgs"
          }))
          
          const { data: newRecords, error: createError } = await supabase
            .from("stock_records")
            .insert(stockRecordsToCreate)
            .select(`
              *,
              product:products(id, name, unit),
              warehouse:warehouses(id, name)
            `)
          
          if (createError) {
            console.error("Error creating stock records:", createError)
          } else {
            console.log(`[SalesManagement] Created ${newRecords?.length || 0} stock records`)
            // Refresh stock records after creating new ones
            await fetchStockRecords()
          }
        }
      }
    } catch (error) {
      console.error("Error ensuring stock records exist:", error)
    }
  }

  const fetchShipments = async () => {
    try {
      let query = supabase
        .from("shipments")
        .select(`
          *,
          product:products(id, name, unit),
          warehouse:warehouses(id, name)
        `)
        .order("created_at", { ascending: false })

      // Apply filters
      if (!isAllValue(filters.year)) {
        query = query.eq("year", Number.parseInt(filters.year))
      }
      if (!isAllValue(filters.month)) {
        query = query.eq("month", Number.parseInt(filters.month))
      }
      if (!isAllValue(filters.product_id)) {
        query = query.eq("product_id", filters.product_id)
      }
      if (!isAllValue(filters.warehouse_id)) {
        query = query.eq("warehouse_id", filters.warehouse_id)
      }

      const { data, error } = await query

      if (error) throw error
      setShipments(data || [])
    } catch (error) {
      console.error("Error fetching shipments:", error)
    }
  }

  const handleCreateSale = async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .insert([
          {
            ...saleForm,
            quantity: Number.parseFloat(saleForm.quantity),
          },
        ])
        .select(`
          *,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      // Add the new sale to the existing sales and sort properly
      const updatedSales = sortSalesByProductAndWarehouseType([...sales, data[0]])
      setSales(updatedSales)
      setSaleForm({
        product_id: "",
        customer_id: "",
        warehouse_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        quantity: "",
        unit: "Kgs",
      })
      setIsSaleDialogOpen(false)
      
      // Dispatch event to notify other components of sales data change
      const event = new Event('salesDataUpdate')
      window.dispatchEvent(event)
    } catch (error) {
      console.error("Error creating sale:", error)
    }
  }

  const handleUpdateSale = async () => {
    if (!selectedSale) return

    try {
      const { data, error } = await supabase
        .from("sales")
        .update({
          ...saleForm,
          quantity: Number.parseFloat(saleForm.quantity),
        })
        .eq("id", selectedSale.id)
        .select(`
          *,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      // Sort the updated sales list
      const updatedSales = sortSalesByProductAndWarehouseType(sales.map((s) => (s.id === selectedSale.id ? data[0] : s)))
      setSales(updatedSales)
      setSaleForm({
        product_id: "",
        customer_id: "",
        warehouse_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        quantity: "",
        unit: "Kgs",
      })
      setSelectedSale(null)
      setIsSaleDialogOpen(false)
      
      // Dispatch event to notify other components of sales data change
      const event = new Event('salesDataUpdate')
      window.dispatchEvent(event)
    } catch (error) {
      console.error("Error updating sale:", error)
    }
  }

  const handleDeleteSale = async (saleId: string) => {
    try {
      const { error } = await supabase.from("sales").delete().eq("id", saleId)

      if (error) throw error

      setSales(sales.filter((s) => s.id !== saleId))
      
      // Dispatch event to notify other components of sales data change
      const event = new Event('salesDataUpdate')
      window.dispatchEvent(event)
    } catch (error) {
      console.error("Error deleting sale:", error)
    }
  }

  // Helper functions for direct inline updates
  const handleUpdateSaleDirect = async (sale: Sale) => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .update({
          quantity: sale.quantity,
        })
        .eq("id", sale.id)
        .select(`
          *,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      // Update the sales list
      const updatedSales = sales.map((s) => (s.id === sale.id ? data[0] : s))
      setSales(updatedSales)
      
      // Update stock records for this sale
      await updateStockRecordsForSale(data[0])
      
      // Dispatch event to notify other components of sales data change
      const event = new Event('salesDataUpdate')
      window.dispatchEvent(event)
    } catch (error) {
      console.error("Error updating sale:", error)
    }
  }

  const handleCreateSaleDirect = async (saleData: any) => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .insert([saleData])
        .select(`
          *,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      // Add to sales list and sort properly to maintain grouping
      const updatedSales = sortSalesByProductAndWarehouseType([...sales, data[0]])
      setSales(updatedSales)
      
      // Update stock records for this product-warehouse combination
      await updateStockRecordsForSale(data[0])
      
      // Dispatch event to notify other components of sales data change
      const event = new Event('salesDataUpdate')
      window.dispatchEvent(event)
    } catch (error) {
      console.error("Error creating sale:", error)
    }
  }

  // Function to recalculate ALL stock records for a product-warehouse combination
  const recalculateAllStockForProductWarehouse = async (productId: string, warehouseId: string) => {
    try {
      console.log(`[SalesManagement] Recalculating all stock for ${productId} - ${warehouseId}`)
      
      // Get all stock records for this product-warehouse combination, ordered by year and month
      const { data: stockRecords, error: stockError } = await supabase
        .from("stock_records")
        .select("*")
        .eq("product_id", productId)
        .eq("warehouse_id", warehouseId)
        .order("year", { ascending: true })
        .order("month", { ascending: true })
      
      if (stockError) {
        console.error("Error fetching stock records:", stockError)
        return
      }
      
      if (!stockRecords || stockRecords.length === 0) return
      
      // Process each month in chronological order
      for (let i = 0; i < stockRecords.length; i++) {
        const record = stockRecords[i]
        
        // Get shipments for this specific month
        const { data: shipments, error: shipmentsError } = await supabase
          .from("shipments")
          .select("quantity")
          .eq("product_id", productId)
          .eq("warehouse_id", warehouseId)
          .eq("month", record.month)
          .eq("year", record.year)
        
        if (shipmentsError) {
          console.error("Error fetching shipments:", shipmentsError)
          continue
        }
        
        // Get sales for this specific month
        const { data: sales, error: salesError } = await supabase
          .from("sales")
          .select("quantity, warehouse:warehouses(name)")
          .eq("product_id", productId)
          .eq("warehouse_id", warehouseId)
          .eq("month", record.month)
          .eq("year", record.year)
        
        if (salesError) {
          console.error("Error fetching sales:", salesError)
          continue
        }
        
        // Only include shipments from non-direct shipment warehouses
        let totalShipments = 0
        if (!isDirectShipment(record.warehouse.name)) {
          totalShipments = shipments?.reduce((sum, s) => sum + s.quantity, 0) || 0
        }
        
        const regularSales = sales?.filter(sale => {
          const warehouseName = (sale.warehouse as any)?.name || ''
          return !isDirectShipment(warehouseName)
        }) || []
        const totalSales = regularSales.reduce((sum, s) => sum + s.quantity, 0)
        
        // Calculate closing stock for this month
        const calculatedClosingStock = record.opening_stock + totalShipments - totalSales
        
        console.log(`[SalesManagement] Month ${record.month}/${record.year}: Opening=${record.opening_stock}, Shipments=${totalShipments}, Sales=${totalSales}, Closing=${calculatedClosingStock}`)
        
        // Update this month's closing stock
        const { error: updateError } = await supabase
          .from("stock_records")
          .update({ closing_stock: calculatedClosingStock })
          .eq("id", record.id)
        
        if (updateError) {
          console.error("Error updating stock record:", updateError)
          continue
        }
        
        // Update next month's opening stock if it exists
        if (i + 1 < stockRecords.length) {
          const nextRecord = stockRecords[i + 1]
          const { error: nextUpdateError } = await supabase
            .from("stock_records")
            .update({ opening_stock: calculatedClosingStock })
            .eq("id", nextRecord.id)
          
          if (nextUpdateError) {
            console.error("Error updating next month's opening stock:", nextUpdateError)
          } else {
            // Update our local copy for the next iteration
            stockRecords[i + 1].opening_stock = calculatedClosingStock
          }
        }
      }
      
      console.log(`[SalesManagement] Finished recalculating all stock for ${productId} - ${warehouseId}`)
      
      // Refresh stock records
      await fetchStockRecords()
      
    } catch (error) {
      console.error("Error recalculating stock:", error)
    }
  }

  // Function to update stock records when sales change
  const updateStockRecordsForSale = async (sale: any) => {
    try {
      console.log(`[SalesManagement] Updating stock records for sale: ${sale.product.name} - ${sale.warehouse.name} - Month ${sale.month}`)
      
      // Get current stock record for this product-warehouse-month-year
      const { data: stockRecord, error: fetchError } = await supabase
        .from("stock_records")
        .select("*")
        .eq("product_id", sale.product_id)
        .eq("warehouse_id", sale.warehouse_id)
        .eq("month", sale.month)
        .eq("year", sale.year)
        .single()
      
      let currentStockRecord = stockRecord
      
      // If no stock record exists, create one
      if (fetchError && fetchError.code === 'PGRST116') {
        console.log(`[SalesManagement] No stock record exists, creating one for ${sale.product.name} - ${sale.warehouse.name} - Month ${sale.month}`)
        
        const { data: newStockRecord, error: createError } = await supabase
          .from("stock_records")
          .insert([{
            product_id: sale.product_id,
            warehouse_id: sale.warehouse_id,
            month: sale.month,
            year: sale.year,
            opening_stock: 0,
            closing_stock: 0,
            unit: sale.unit || "Kgs"
          }])
          .select("*")
          .single()
        
        if (createError) {
          console.error("Error creating stock record:", createError)
          return
        }
        
        currentStockRecord = newStockRecord
        console.log(`[SalesManagement] Created new stock record:`, newStockRecord)
      } else if (fetchError) {
        console.error("Error fetching stock record:", fetchError)
        return
      }
      
      // Recalculate ALL stock records for this product-warehouse combination
      // This ensures proper carry-forward calculations
      await recalculateAllStockForProductWarehouse(sale.product_id, sale.warehouse_id)
      
      // Dispatch event to notify other components of sales data change
      const event = new Event('salesDataUpdate')
      window.dispatchEvent(event)
      
    } catch (error) {
      console.error("Error updating stock records for sale:", error)
    }
  }

  // Function to handle carry-forward of closing stock to next month's opening stock
  const handleCarryForwardStock = async (productId: string, warehouseId: string, currentMonth: number, currentYear: number, closingStock: number) => {
    try {
      // Determine next month and year
      let nextMonth = currentMonth + 1
      let nextYear = currentYear
      
      if (nextMonth > 12) {
        nextMonth = 1
        nextYear = currentYear + 1
      }
      
      console.log(`[SalesManagement] Carrying forward stock from ${currentMonth}/${currentYear} to ${nextMonth}/${nextYear}: ${closingStock}`)
      
      // Check if next month's stock record exists
      const { data: nextStockRecord, error: fetchError } = await supabase
        .from("stock_records")
        .select("*")
        .eq("product_id", productId)
        .eq("warehouse_id", warehouseId)
        .eq("month", nextMonth)
        .eq("year", nextYear)
        .single()
      
      if (fetchError && fetchError.code === 'PGRST116') {
        // Create next month's stock record with current closing stock as opening stock
        console.log(`[SalesManagement] Creating next month's stock record for ${nextMonth}/${nextYear}`)
        
        const { error: createError } = await supabase
          .from("stock_records")
          .insert([{
            product_id: productId,
            warehouse_id: warehouseId,
            month: nextMonth,
            year: nextYear,
            opening_stock: closingStock,
            closing_stock: closingStock, // Initially same as opening, will be updated when sales/shipments are added
            unit: "Kgs"
          }])
        
        if (createError) {
          console.error("Error creating next month's stock record:", createError)
        } else {
          console.log(`[SalesManagement] Created next month's stock record with opening stock: ${closingStock}`)
        }
      } else if (fetchError) {
        console.error("Error fetching next month's stock record:", fetchError)
      } else if (nextStockRecord) {
        // Update existing next month's opening stock
        const { error: updateError } = await supabase
          .from("stock_records")
          .update({ opening_stock: closingStock })
          .eq("id", nextStockRecord.id)
        
        if (updateError) {
          console.error("Error updating next month's opening stock:", updateError)
        } else {
          console.log(`[SalesManagement] Updated next month's opening stock to: ${closingStock}`)
        }
      }
    } catch (error) {
      console.error("Error handling carry-forward stock:", error)
    }
  }

  // Function to recalculate all stock records based on current sales data
  const recalculateAllStockRecords = async () => {
    try {
      console.log('[SalesManagement] Recalculating all stock records...')
      
      // Get all unique product-warehouse combinations from sales
      const uniqueCombinations = new Set<string>()
      sales.forEach(sale => {
        const key = `${sale.product_id}-${sale.warehouse_id}`
        uniqueCombinations.add(key)
      })
      
      for (const combination of uniqueCombinations) {
        const [productId, warehouseId] = combination.split('-')
        
        // Get all months that have sales for this combination
        const monthsWithSales = sales
          .filter(sale => sale.product_id === productId && sale.warehouse_id === warehouseId)
          .map(sale => ({ month: sale.month, year: sale.year }))
        
        // Recalculate stock for each month
        for (const { month, year } of monthsWithSales) {
          await updateStockRecordsForSale({
            product_id: productId,
            warehouse_id: warehouseId,
            month,
            year,
            unit: "Kgs"
          })
        }
      }
      
      console.log('[SalesManagement] Finished recalculating all stock records')
    } catch (error) {
      console.error("Error recalculating all stock records:", error)
    }
  }

  const openEditDialog = (sale: Sale) => {
    setSelectedSale(sale)
    setSaleForm({
      product_id: sale.product_id,
      customer_id: sale.customer_id,
      warehouse_id: sale.warehouse_id,
      month: sale.month,
      year: sale.year,
      quantity: sale.quantity.toString(),
      unit: sale.unit,
    })
    setIsSaleDialogOpen(true)
  }

  const openNewSaleDialog = () => {
    setSelectedSale(null)
    setSaleForm({
      product_id: "",
      customer_id: "",
      warehouse_id: "",
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      quantity: "",
      unit: "Kgs",
    })
    setIsSaleDialogOpen(true)
  }

  const clearFilters = () => {
    setFilters({
      month: "",
      year: new Date().getFullYear().toString(),
      product_id: "",
      customer_id: "",
      warehouse_id: "",
    })
  }

  const getTotalSales = () => {
    return sales.reduce((total, sale) => total + sale.quantity, 0)
  }

  if (loading) {
    console.log('[SalesManagement] Component is loading...')
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted">Loading sales data...</div>
      </div>
    )
  }

  console.log('[SalesManagement] Component rendering with sales data:', sales.length, 'records')
  console.log('[SalesManagement] About to render the main component')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Sales Management</h2>
          <p className="text-muted mt-1">Track and manage monthly sales records</p>
        </div>
        <Button onClick={openNewSaleDialog} className="bg-secondary hover:bg-secondary/90">
          <Plus className="h-4 w-4 mr-2" />
          Record Sale
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter sales records by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={filters.year} onValueChange={(value) => setFilters({ ...filters, year: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={filters.month} onValueChange={(value) => setFilters({ ...filters, month: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All months</SelectItem>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={filters.product_id}
                onValueChange={(value) => setFilters({ ...filters, product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={filters.customer_id}
                onValueChange={(value) => setFilters({ ...filters, customer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All customers</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select
                value={filters.warehouse_id}
                onValueChange={(value) => setFilters({ ...filters, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={clearFilters} className="w-full bg-transparent">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sales.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalSales().toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filters.month ? MONTHS[Number.parseInt(filters.month) - 1] : "All"} {filters.year}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Records</CardTitle>
          <CardDescription>
            View and manage all sales transactions. Records are grouped by product-warehouse combinations with separate sections for each warehouse.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] border rounded-md bg-muted/20 relative overflow-hidden">
            <div className="h-full w-full overflow-auto p-4" style={{ scrollbarWidth: 'thin' }}>
              {(() => {
                const groupedSales = groupSalesByProductWarehouse(sales)
                console.log('[SalesManagement] Raw sales data:', sales)
                console.log('[SalesManagement] Grouped sales:', groupedSales)
                console.log('[SalesManagement] Number of groups:', Object.keys(groupedSales).length)
                console.log('[SalesManagement] Group keys:', Object.keys(groupedSales))
                
                const sortedGroups = Object.keys(groupedSales).sort((a, b) => {
                  const [productA, warehouseA] = a.split('|')
                  const [productB, warehouseB] = b.split('|')
                  
                  // First sort by product name
                  const productComparison = productA.localeCompare(productB)
                  if (productComparison !== 0) return productComparison
                  
                  // Then sort by warehouse type (regular first, then direct)
                  const aIsDirect = isDirectShipment(warehouseA)
                  const bIsDirect = isDirectShipment(warehouseB)
                  if (aIsDirect !== bIsDirect) return aIsDirect ? 1 : -1
                  
                  // Finally sort by warehouse name
                  return warehouseA.localeCompare(warehouseB)
                })
                
                console.log('[SalesManagement] Sorted groups:', sortedGroups)
                
                // Debug: Check if we have multiple groups
                if (sortedGroups.length === 0) {
                  return <div className="text-center text-lg text-gray-500 p-8">No sales data found</div>
                }
                
                return (
                  <div className="space-y-20">
                    {sortedGroups.map((groupKey, index) => {
                      const [productName, warehouseName] = groupKey.split('|')
                      const groupSales = groupedSales[groupKey]
                      const firstSale = groupSales[0]
                      const isDirect = isDirectShipment(warehouseName)
                      
                      console.log(`[SalesManagement] Rendering group ${index + 1}: ${productName} - ${warehouseName} with ${groupSales.length} sales`)
                      console.log(`[SalesManagement] Group sales data:`, groupSales.map(s => ({ customer: s.customer.name, warehouse: s.warehouse.name })))
                      console.log(`[SalesManagement] Full group sales:`, groupSales)
                      
                      return (
                        <div key={`${groupKey}-${index}`} className="border-4 border-red-600 rounded-xl p-8 bg-white shadow-2xl">
                          {/* Section Header */}
                          <div className="mb-8 text-center">
                            <div className="text-2xl font-bold text-red-700 bg-red-100 px-8 py-4 rounded-xl border-4 border-red-300">
                              SECTION {index + 1}: {productName} - {warehouseName}
                            </div>
                            <div className="mt-2 text-sm text-gray-600">
                              Total Sections: {sortedGroups.length} | Current Section: {index + 1}
                            </div>
                          </div>
                          
                          {/* Product-Warehouse Info */}
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl border-4 border-blue-400 shadow-lg mb-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <h3 className="text-2xl font-bold text-blue-900">{productName}</h3>
                                <Badge variant="outline" className="text-lg bg-blue-200 text-blue-900 border-blue-500 font-bold px-4 py-2">
                                  Warehouse: {warehouseName}
                                </Badge>
                                {isDirect && (
                                  <Badge variant="secondary" className="text-sm bg-orange-200 text-orange-900 font-bold px-3 py-1">
                                    Direct Shipment
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-sm bg-gray-200 text-gray-900 font-bold px-3 py-1">
                                  {firstSale.unit}
                                </Badge>
                              </div>
                              <div className="text-lg text-blue-700 font-bold">
                                {groupSales.length} record{groupSales.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>

                          {/* Individual Table for this Product-Warehouse */}
                          <div className="overflow-x-auto">
                            <div className="mb-6 p-4 bg-yellow-100 border-4 border-yellow-400 rounded-xl">
                              <div className="text-center text-xl font-bold text-yellow-800">
                                TABLE {index + 1}: {productName} - {warehouseName} Data
                              </div>
                            </div>
                            <Table className="min-w-full border-2 border-gray-300">
                              <TableHeader>
                                <TableRow className="bg-gray-100">
                                  <TableHead className="w-[200px] font-bold">Product Name</TableHead>
                                  <TableHead className="w-[150px] font-bold">Customer Name</TableHead>
                                  <TableHead className="w-[100px] font-bold">Warehouse</TableHead>
                                  <TableHead className="w-[80px] font-bold">Unit</TableHead>
                                  <TableHead className="w-[100px] font-bold">Annual Volume</TableHead>
                                  <TableHead className="w-[120px] font-bold">Sales Dec 24</TableHead>
                                  <TableHead className="w-[120px] font-bold">Sales Jan 25</TableHead>
                                  <TableHead className="w-[120px] font-bold">Sales Feb 25</TableHead>
                                  <TableHead className="w-[120px] font-bold">Sales Mar 25</TableHead>
                                  <TableHead className="w-[120px] font-bold">Sales Apr 25</TableHead>
                                  <TableHead className="w-[120px] font-bold">Sales May 25</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {/* Customer Sales Rows */}
                                {(() => {
                                  const uniqueCustomers = Array.from(new Set(groupSales.map(sale => sale.customer.name)))
                                  
                                  return uniqueCustomers.map(customerName => (
                                    <TableRow key={customerName} className="hover:bg-gray-50">
                                      <TableCell className="font-bold">{productName}</TableCell>
                                      <TableCell className="font-medium">{customerName}</TableCell>
                                      <TableCell className="font-medium">{warehouseName}</TableCell>
                                      <TableCell>{firstSale.unit}</TableCell>
                                      <TableCell>0</TableCell>
                                      {[12, 1, 2, 3, 4, 5].map(month => {
                                        const monthYear = getDisplayYearForMonth(month)
                                        const monthSale = groupSales.find(
                                          s => s.customer.name === customerName && s.month === month && s.year === monthYear
                                        )
                                        const key = buildSaleKey(firstSale.product_id, monthSale?.customer_id || groupSales.find(s => s.customer.name === customerName)?.customer_id || '', firstSale.warehouse_id, month, monthYear)
                                        const pending = pendingQuantities[key]
                                        const inputValue = pending !== undefined ? pending : (monthSale?.quantity ?? '')

                                        return (
                                          <TableCell key={month}>
                                            <Input
                                              type="number"
                                              value={inputValue}
                                              className="w-full h-8 border-2"
                                              onChange={(e) => {
                                                const newQty = parseFloat(e.target.value)
                                                const qty = Number.isFinite(newQty) ? newQty : 0
                                                const customerId = monthSale?.customer_id || groupSales.find(s => s.customer.name === customerName)?.customer_id
                                                if (!customerId) return

                                                scheduleSaveQuantity(
                                                  firstSale.product_id,
                                                  customerId,
                                                  firstSale.warehouse_id,
                                                  firstSale.unit,
                                                  month,
                                                  monthYear,
                                                  qty
                                                )
                                              }}
                                            />
                                          </TableCell>
                                        )
                                      })}
                                    </TableRow>
                                  ))
                                })()}

                                {/* Opening Stock Row */}
                                <TableRow className="bg-blue-100 border-2 border-blue-300">
                                  <TableCell className="font-bold text-lg">Opening Stock</TableCell>
                                  <TableCell className="font-bold">{productName}</TableCell>
                                  <TableCell className="font-bold">{warehouseName}</TableCell>
                                  <TableCell>{firstSale.unit}</TableCell>
                                  <TableCell></TableCell>
                                  {[12, 1, 2, 3, 4, 5].map(month => {
                                    const stockRecord = stockRecords.find(s => 
                                      s.product.name === productName && 
                                      s.warehouse.name === warehouseName && 
                                      s.month === month
                                    )
                                    console.log(`[SalesManagement] Looking for stock record: ${productName} - ${warehouseName} - Month ${month}`)
                                    console.log(`[SalesManagement] Found stock record:`, stockRecord)
                                    return (
                                      <TableCell key={month}>
                                        <div className="border-2 border-blue-500 rounded px-2 py-1 bg-white text-center font-mono font-bold">
                                          {stockRecord?.opening_stock?.toLocaleString() || '0'}
                                        </div>
                                      </TableCell>
                                    )
                                  })}
                                </TableRow>

                                {/* Shipments Row */}
                                <TableRow className="bg-orange-100 border-2 border-orange-300">
                                  <TableCell className="font-bold text-lg">Shipments</TableCell>
                                  <TableCell className="font-bold">{productName}</TableCell>
                                  <TableCell className="font-bold">{warehouseName}</TableCell>
                                  <TableCell>{firstSale.unit}</TableCell>
                                  <TableCell></TableCell>
                                  {[12, 1, 2, 3, 4, 5].map(month => {
                                    const monthShipments = shipments.filter(s => 
                                      s.product.name === productName && 
                                      s.warehouse.name === warehouseName && 
                                      s.month === month
                                    )
                                    
                                    return (
                                      <TableCell key={month}>
                                        <div className="space-y-1">
                                          {monthShipments.map((shipment, index) => (
                                            <div key={index} className="flex items-center gap-1 text-xs">
                                              <span className="flex-1 font-bold">{shipment.container_number} {shipment.quantity}</span>
                                              <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                              <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-red-500">
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ))}
                                          <Button variant="outline" size="sm" className="w-full h-6 text-xs font-bold">
                                            + Shipment
                                          </Button>
                                        </div>
                                      </TableCell>
                                    )
                                  })}
                                </TableRow>

                                {/* Closing Stock Row */}
                                <TableRow className="bg-green-100 border-2 border-green-300">
                                  <TableCell className="font-bold text-lg">Closing Stock</TableCell>
                                  <TableCell className="font-bold">{productName}</TableCell>
                                  <TableCell className="font-bold">{warehouseName}</TableCell>
                                  <TableCell>{firstSale.unit}</TableCell>
                                  <TableCell></TableCell>
                                  {[12, 1, 2, 3, 4, 5].map(month => {
                                    const monthYear = getDisplayYearForMonth(month)
                                    const stockRecord = stockRecords.find(s => 
                                      s.product.name === productName && 
                                      s.warehouse.name === warehouseName && 
                                      s.month === month &&
                                      s.year === monthYear
                                    )
                                    
                                    // Check for pending stock calculation
                                    const stockKey = `stock-${firstSale.product_id}-${firstSale.warehouse_id}-${month}-${monthYear}`
                                    const pendingClosingStock = pendingStockCalculations[stockKey]
                                    const displayValue = pendingClosingStock !== undefined ? pendingClosingStock : (stockRecord?.closing_stock ?? 0)
                                    
                                    console.log(`[SalesManagement] Looking for closing stock: ${productName} - ${warehouseName} - Month ${month}`)
                                    console.log(`[SalesManagement] Found closing stock record:`, stockRecord)
                                    console.log(`[SalesManagement] Pending calculation:`, pendingClosingStock)
                                    console.log(`[SalesManagement] Display value:`, displayValue)
                                    
                                    return (
                                      <TableCell key={month}>
                                        <div className="border-2 border-green-500 rounded px-2 py-1 bg-white text-center font-mono text-green-700 font-bold">
                                          {displayValue.toLocaleString()}
                                        </div>
                                      </TableCell>
                                    )
                                  })}
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-end gap-4 mt-6">
                            <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3">
                              <Plus className="h-5 w-5 mr-2" />
                              + Add Product
                            </Button>
                            <Button className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3">
                              <Plus className="h-5 w-5 mr-2" />
                              + Add Direct Ship
                            </Button>
                          </div>
                          
                          {/* Section Footer with Red Line */}
                          <div className="mt-8 pt-6">
                            <div className="border-t-8 border-red-600 my-6"></div>
                            <div className="text-center text-2xl font-bold text-red-700 bg-red-100 px-8 py-4 rounded-xl border-4 border-red-400">
                              END OF SECTION: {productName} - {warehouseName}
                            </div>
                            <div className="border-t-8 border-red-600 my-6"></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sale Dialog */}
      <Dialog open={isSaleDialogOpen} onOpenChange={setIsSaleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedSale ? "Edit Sale" : "Record New Sale"}</DialogTitle>
            <DialogDescription>{selectedSale ? "Update sale information" : "Add a new sales record"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={saleForm.product_id}
                onValueChange={(value) => {
                  const product = products.find((p) => p.id === value)
                  setSaleForm({
                    ...saleForm,
                    product_id: value,
                    unit: product?.unit || "Kgs",
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select product</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer">Customer</Label>
              <Select
                value={saleForm.customer_id}
                onValueChange={(value) => setSaleForm({ ...saleForm, customer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select
                value={saleForm.warehouse_id}
                onValueChange={(value) => setSaleForm({ ...saleForm, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select warehouse</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="month">Month</Label>
                <Select
                  value={saleForm.month.toString()}
                  onValueChange={(value) => setSaleForm({ ...saleForm, month: Number.parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Select month</SelectItem>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={month} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={saleForm.year}
                  onChange={(e) => setSaleForm({ ...saleForm, year: Number.parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={saleForm.quantity}
                  onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                  placeholder="Enter quantity"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={saleForm.unit} onValueChange={(value) => setSaleForm({ ...saleForm, unit: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kgs">Kgs</SelectItem>
                    <SelectItem value="Lbs">Lbs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={selectedSale ? handleUpdateSale : handleCreateSale}
              className="bg-secondary hover:bg-secondary/90"
            >
              {selectedSale ? "Update" : "Record"} Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debug button for WOODS recalculation */}
      <div className="mt-4 p-4 bg-yellow-100 border border-yellow-300 rounded">
        <Button 
          onClick={async () => {
            console.log('[DEBUG] Forcing WOODS recalculation...')
            const woodsSales = sales.filter(s => s.warehouse.name === 'WOODS')
            console.log('[DEBUG] WOODS sales found:', woodsSales)
            
            // Force immediate processing
            for (const sale of woodsSales) {
              console.log('[DEBUG] Processing WOODS sale:', sale)
              await updateStockRecordsForSale(sale)
            }
            
            // Force multiple refreshes
            setTimeout(() => fetchStockRecords(), 500)
            setTimeout(() => fetchStockRecords(), 1000)
            setTimeout(() => fetchStockRecords(), 2000)
            
            console.log('[DEBUG] WOODS recalculation completed')
          }}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          🔧 Force WOODS Recalculation
        </Button>
        <p className="text-sm text-gray-600 mt-2">
          Click this button if WOODS calculations are not working properly
        </p>
      </div>
    </div>
  )
}
