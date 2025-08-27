"use client"

import { useState, useEffect } from "react"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Edit, Trash2, Ship, CalendarIcon, Container, Search } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"

interface Product {
  id: string
  name: string
  unit: string
}

interface Warehouse {
  id: string
  name: string
}

interface Shipment {
  id: string
  product_id: string
  warehouse_id: string
  container_number: string
  quantity: number
  unit: string
  shipment_date: string
  month: number
  year: number
  created_at: string
  product: Product
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

export function ShipmentManagement() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Filter states
  const [filters, setFilters] = useState({
    month: "",
    year: new Date().getFullYear().toString(),
    product_id: "",
    warehouse_id: "",
    container_number: "",
    date_from: "",
    date_to: "",
  })

  // Form states
  const [shipmentForm, setShipmentForm] = useState({
    product_id: "",
    warehouse_id: "",
    container_number: "",
    quantity: "",
    unit: "Kgs",
    shipment_date: new Date(),
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchFilteredShipments()
  }, [filters])

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

      // Fetch warehouses
      const { data: warehousesData, error: warehousesError } = await supabase
        .from("warehouses")
        .select("id, name")
        .order("name")

      if (warehousesError) throw warehousesError
      setWarehouses(warehousesData || [])

      // Initial shipments fetch
      await fetchFilteredShipments()
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFilteredShipments = async () => {
    try {
      let query = supabase
        .from("shipments")
        .select(`
          *,
          product:products(id, name, unit),
          warehouse:warehouses(id, name)
        `)
        .order("shipment_date", { ascending: false })

      // Apply filters
      if (filters.year) {
        query = query.eq("year", Number.parseInt(filters.year))
      }
      if (filters.month) {
        query = query.eq("month", Number.parseInt(filters.month))
      }
      if (filters.product_id) {
        query = query.eq("product_id", filters.product_id)
      }
      if (filters.warehouse_id) {
        query = query.eq("warehouse_id", filters.warehouse_id)
      }
      if (filters.container_number) {
        query = query.ilike("container_number", `%${filters.container_number}%`)
      }
      if (filters.date_from) {
        query = query.gte("shipment_date", filters.date_from)
      }
      if (filters.date_to) {
        query = query.lte("shipment_date", filters.date_to)
      }

      const { data, error } = await query

      if (error) throw error
      setShipments(data || [])
    } catch (error) {
      console.error("Error fetching shipments:", error)
    }
  }

  const handleCreateShipment = async () => {
    try {
      const shipmentDate = new Date(shipmentForm.shipment_date)
      const month = shipmentDate.getMonth() + 1
      const year = shipmentDate.getFullYear()

      const { data, error } = await supabase
        .from("shipments")
        .insert([
          {
            product_id: shipmentForm.product_id,
            warehouse_id: shipmentForm.warehouse_id,
            container_number: shipmentForm.container_number,
            quantity: Number.parseFloat(shipmentForm.quantity),
            unit: shipmentForm.unit,
            shipment_date: format(shipmentForm.shipment_date, "yyyy-MM-dd"),
            month: month,
            year: year,
          },
        ])
        .select(`
          *,
          product:products(id, name, unit),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      setShipments([data[0], ...shipments])
      setShipmentForm({
        product_id: "",
        warehouse_id: "",
        container_number: "",
        quantity: "",
        unit: "Kgs",
        shipment_date: new Date(),
      })
      setIsShipmentDialogOpen(false)
    } catch (error) {
      console.error("Error creating shipment:", error)
    }
  }

  const handleUpdateShipment = async () => {
    if (!selectedShipment) return

    try {
      const shipmentDate = new Date(shipmentForm.shipment_date)
      const month = shipmentDate.getMonth() + 1
      const year = shipmentDate.getFullYear()

      const { data, error } = await supabase
        .from("shipments")
        .update({
          product_id: shipmentForm.product_id,
          warehouse_id: shipmentForm.warehouse_id,
          container_number: shipmentForm.container_number,
          quantity: Number.parseFloat(shipmentForm.quantity),
          unit: shipmentForm.unit,
          shipment_date: format(shipmentForm.shipment_date, "yyyy-MM-dd"),
          month: month,
          year: year,
        })
        .eq("id", selectedShipment.id)
        .select(`
          *,
          product:products(id, name, unit),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      setShipments(shipments.map((s) => (s.id === selectedShipment.id ? data[0] : s)))
      setShipmentForm({
        product_id: "",
        warehouse_id: "",
        container_number: "",
        quantity: "",
        unit: "Kgs",
        shipment_date: new Date(),
      })
      setSelectedShipment(null)
      setIsShipmentDialogOpen(false)
    } catch (error) {
      console.error("Error updating shipment:", error)
    }
  }

  const handleDeleteShipment = async (shipmentId: string) => {
    try {
      const { error } = await supabase.from("shipments").delete().eq("id", shipmentId)

      if (error) throw error

      setShipments(shipments.filter((s) => s.id !== shipmentId))
    } catch (error) {
      console.error("Error deleting shipment:", error)
    }
  }

  const openEditDialog = (shipment: Shipment) => {
    setSelectedShipment(shipment)
    setShipmentForm({
      product_id: shipment.product_id,
      warehouse_id: shipment.warehouse_id,
      container_number: shipment.container_number,
      quantity: shipment.quantity.toString(),
      unit: shipment.unit,
      shipment_date: new Date(shipment.shipment_date),
    })
    setIsShipmentDialogOpen(true)
  }

  const openNewShipmentDialog = () => {
    setSelectedShipment(null)
    setShipmentForm({
      product_id: "",
      warehouse_id: "",
      container_number: "",
      quantity: "",
      unit: "Kgs",
      shipment_date: new Date(),
    })
    setIsShipmentDialogOpen(true)
  }

  const clearFilters = () => {
    setFilters({
      month: "",
      year: new Date().getFullYear().toString(),
      product_id: "",
      warehouse_id: "",
      container_number: "",
      date_from: "",
      date_to: "",
    })
  }

  const getTotalQuantity = () => {
    return shipments.reduce((total, shipment) => total + shipment.quantity, 0)
  }

  const getUniqueContainers = () => {
    return new Set(shipments.map((s) => s.container_number)).size
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted">Loading shipment data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Shipment Management</h2>
          <p className="text-muted mt-1">Track and manage product shipments with container numbers</p>
        </div>
        <Button onClick={openNewShipmentDialog} className="bg-secondary hover:bg-secondary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Shipment
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter shipments by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Container Number</Label>
              <Input
                placeholder="Search container..."
                value={filters.container_number}
                onChange={(e) => setFilters({ ...filters, container_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear All Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shipment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shipments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalQuantity().toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unique Containers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getUniqueContainers()}</div>
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

      {/* Shipments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Shipment Records</CardTitle>
          <CardDescription>View and manage all shipment transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment Date</TableHead>
                <TableHead>Container Number</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted" />
                      {format(new Date(shipment.shipment_date), "MMM dd, yyyy")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Container className="h-4 w-4 text-muted" />
                      <span className="font-mono">{shipment.container_number}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{shipment.product.name}</TableCell>
                  <TableCell>{shipment.warehouse.name}</TableCell>
                  <TableCell className="font-mono">{shipment.quantity.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{shipment.unit}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Ship className="h-4 w-4 text-muted" />
                      {MONTHS[shipment.month - 1]} {shipment.year}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(shipment)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteShipment(shipment.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Shipment Dialog */}
      <Dialog open={isShipmentDialogOpen} onOpenChange={setIsShipmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedShipment ? "Edit Shipment" : "Add New Shipment"}</DialogTitle>
            <DialogDescription>
              {selectedShipment ? "Update shipment information" : "Record a new shipment"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={shipmentForm.product_id}
                onValueChange={(value) => {
                  const product = products.find((p) => p.id === value)
                  setShipmentForm({
                    ...shipmentForm,
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
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select
                value={shipmentForm.warehouse_id}
                onValueChange={(value) => setShipmentForm({ ...shipmentForm, warehouse_id: value })}
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

            <div className="grid gap-2">
              <Label htmlFor="container_number">Container Number</Label>
              <Input
                id="container_number"
                value={shipmentForm.container_number}
                onChange={(e) => setShipmentForm({ ...shipmentForm, container_number: e.target.value })}
                placeholder="Enter container number"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={shipmentForm.quantity}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, quantity: e.target.value })}
                  placeholder="Enter quantity"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={shipmentForm.unit}
                  onValueChange={(value) => setShipmentForm({ ...shipmentForm, unit: value })}
                >
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

            <div className="grid gap-2">
              <Label>Shipment Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !shipmentForm.shipment_date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {shipmentForm.shipment_date ? format(shipmentForm.shipment_date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={shipmentForm.shipment_date}
                    onSelect={(date) => date && setShipmentForm({ ...shipmentForm, shipment_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShipmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={selectedShipment ? handleUpdateShipment : handleCreateShipment}
              className="bg-secondary hover:bg-secondary/90"
            >
              {selectedShipment ? "Update" : "Add"} Shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
