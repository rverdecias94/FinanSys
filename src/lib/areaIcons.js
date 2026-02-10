import {
  Warehouse, Bed, Lamp, Refrigerator, Utensils, Home, Hammer, WashingMachine,
  Sofa, Tv, Briefcase, Box, Archive, ConciergeBell, Bath, Car, Users,
  Coffee, Flower, Sun, Monitor, ChefHat, Armchair
} from 'lucide-react'

export const AREA_ICONS = [
  // General & Common
  { key: 'Home', Comp: Home, label: 'Casa/General' },
  { key: 'ConciergeBell', Comp: ConciergeBell, label: 'Recepción' },
  { key: 'Sofa', Comp: Sofa, label: 'Sala de Estar' },
  { key: 'Utensils', Comp: Utensils, label: 'Comedor' },
  { key: 'ChefHat', Comp: ChefHat, label: 'Cocina' },
  { key: 'Bath', Comp: Bath, label: 'Baño' },
  { key: 'Bed', Comp: Bed, label: 'Dormitorio' },

  // Work & Office
  { key: 'Briefcase', Comp: Briefcase, label: 'Oficina' },
  { key: 'Users', Comp: Users, label: 'Sala de Reuniones' },
  { key: 'Monitor', Comp: Monitor, label: 'Escritorio/Trabajo' },
  { key: 'Hammer', Comp: Hammer, label: 'Taller/Mantenimiento' },

  // Storage & Logistics
  { key: 'Warehouse', Comp: Warehouse, label: 'Almacén' },
  { key: 'Box', Comp: Box, label: 'Depósito' },
  { key: 'Archive', Comp: Archive, label: 'Archivo' },

  // Services & Amenities
  { key: 'WashingMachine', Comp: WashingMachine, label: 'Lavandería' },
  { key: 'Car', Comp: Car, label: 'Estacionamiento' },
  { key: 'Coffee', Comp: Coffee, label: 'Cafetería/Break' },
  { key: 'Flower', Comp: Flower, label: 'Jardín/Exterior' },
  { key: 'Sun', Comp: Sun, label: 'Terraza' },

  // Specific Items/Functions
  { key: 'Refrigerator', Comp: Refrigerator, label: 'Electrodomésticos' },
  { key: 'Lamp', Comp: Lamp, label: 'Iluminación' },
  { key: 'Armchair', Comp: Armchair, label: 'Mobiliario' },
  { key: 'Tv', Comp: Tv, label: 'Entretenimiento' }
]

export function getAreaIcon(key) {
  const iconDef = AREA_ICONS.find(i => i.key === key)
  return iconDef ? iconDef.Comp : Home
}
