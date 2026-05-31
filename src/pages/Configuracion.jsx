import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getBalanceConfig, updateBalanceConfig } from '@/services/finanzas'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useCurrency } from '@/context/CurrencyContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Users, Crown, UserPlus, Trash2, CheckCircle2, Loader2, Coins, Star, StarOff, Shield } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/config/supabase'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RoleManagement } from '@/components/config/RoleManagement'
import { TeamManagement } from '@/components/config/TeamManagement'
import { PermissionSettings } from '@/components/config/PermissionSettings'
import { Switch } from '@/components/ui/switch'
import { usePermissions } from '@/context/PermissionContext'

const FLAGS = {
  CUP: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <path d="M5,4H27c2.208,0,4,1.792,4,4v2H1v-2c0-2.208,1.792-4,4-4Z" fill="#0c258b"></path>
              <path d="M5,22H27c2.208,0,4,1.792,4,4v2H1v-2c0-2.208,1.792-4,4-4Z" transform="rotate(180 16 25)" fill="#0c258b"></path>
              <path fill="#fff" d="M1 18H31V23H1z"></path>
              <path fill="#fff" d="M1 9H31V14H1z"></path>
              <path fill="#0c258b" d="M1 13.5H31V18.5H1z"></path>
              <path d="M2.316,26.947l13.684-10.947L2.316,5.053c-.803,.732-1.316,1.776-1.316,2.947V24c0,1.172,.513,2.216,1.316,2.947Z" fill="#bc2b20"></path>
              <path d="M27,4H5c-2.209,0-4,1.791-4,4V24c0,2.209,1.791,4,4,4H27c2.209,0,4-1.791,4-4V8c0-2.209-1.791-4-4-4Zm3,20c0,1.654-1.346,3-3,3H5c-1.654,0-3-1.346-3-3V8c0-1.654,1.346-3,3-3H27c1.654,0,3,1.346,3,3V24Z" opacity=".15"></path>
              <path fill="#fff" d="M8.016 16.628L10.318 14.956 7.473 14.956 6.594 12.25 5.715 14.956 2.87 14.956 5.171 16.628 4.292 19.333 6.594 17.661 8.895 19.333 8.016 16.628z"></path>
              <path d="M27,5H5c-1.657,0-3,1.343-3,3v1c0-1.657,1.343-3,3-3H27c1.657,0,3,1.343,3,3v-1c0-1.657-1.343-3-3-3Z" fill="#fff" opacity=".2"></path>
            </svg>`,
  EUR: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <rect x="1" y="4" width="30" height="24" rx="4" ry="4" fill="#112f95"></rect>
              <path d="M27,4H5c-2.209,0-4,1.791-4,4V24c0,2.209,1.791,4,4,4H27c2.209,0,4-1.791,4-4V8c0-2.209-1.791-4-4-4Zm3,20c0,1.654-1.346,3-3,3H5c-1.654,0-3-1.346-3-3V8c0-1.654,1.346-3,3-3H27c1.654,0,3,1.346,3,3V24Z" opacity=".15"></path>
              <path fill="#f6cd46" d="M16 8.167L15.745 8.951 14.921 8.951 15.588 9.435 15.333 10.219 16 9.735 16.667 10.219 16.412 9.435 17.079 8.951 16.255 8.951 16 8.167z"></path>
              <path fill="#f6cd46" d="M16.255 22.565L16 21.781 15.745 22.565 14.921 22.565 15.588 23.049 15.333 23.833 16 23.349 16.667 23.833 16.412 23.049 17.079 22.565 16.255 22.565z"></path>
              <path fill="#f6cd46" d="M9.193 16.542L9.86 17.026 9.605 16.242 10.272 15.758 9.448 15.758 9.193 14.974 8.938 15.758 8.114 15.758 8.781 16.242 8.526 17.026 9.193 16.542z"></path>
              <path fill="#f6cd46" d="M12.596 9.079L12.342 9.863 11.517 9.863 12.184 10.347 11.93 11.131 12.596 10.647 13.263 11.131 13.009 10.347 13.675 9.863 12.851 9.863 12.596 9.079z"></path>
              <path fill="#f6cd46" d="M10.105 11.57L9.85 12.354 9.026 12.354 9.693 12.839 9.438 13.623 10.105 13.138 10.772 13.623 10.517 12.839 11.184 12.354 10.36 12.354 10.105 11.57z"></path>
              <path fill="#f6cd46" d="M10.36 19.161L10.105 18.377 9.85 19.161 9.026 19.161 9.693 19.646 9.438 20.43 10.105 19.945 10.772 20.43 10.517 19.646 11.184 19.161 10.36 19.161z"></path>
              <path fill="#f6cd46" d="M12.851 21.653L12.596 20.869 12.342 21.653 11.517 21.653 12.184 22.137 11.93 22.921 12.596 22.437 13.263 22.921 13.009 22.137 13.675 21.653 12.851 21.653z"></path>
              <path fill="#f6cd46" d="M23.886 15.758L23.062 15.758 22.807 14.974 22.552 15.758 21.728 15.758 22.395 16.242 22.14 17.026 22.807 16.542 23.474 17.026 23.219 16.242 23.886 15.758z"></path>
              <path fill="#f6cd46" d="M19.404 9.079L19.149 9.863 18.325 9.863 18.991 10.347 18.737 11.131 19.404 10.647 20.07 11.131 19.816 10.347 20.483 9.863 19.658 9.863 19.404 9.079z"></path>
              <path fill="#f6cd46" d="M21.483 12.839L21.228 13.623 21.895 13.138 22.562 13.623 22.307 12.839 22.974 12.354 22.15 12.354 21.895 11.57 21.64 12.354 20.816 12.354 21.483 12.839z"></path>
              <path fill="#f6cd46" d="M22.15 19.161L21.895 18.377 21.64 19.161 20.816 19.161 21.483 19.646 21.228 20.43 21.895 19.945 22.562 20.43 22.307 19.646 22.974 19.161 22.15 19.161z"></path>
              <path fill="#f6cd46" d="M19.658 21.653L19.404 20.869 19.149 21.653 18.325 21.653 18.991 22.137 18.737 22.921 19.404 22.437 20.07 22.921 19.816 22.137 20.483 21.653 19.658 21.653z"></path>
              <path d="M27,5H5c-1.657,0-3,1.343-3,3v1c0-1.657,1.343-3,3-3H27c1.657,0,3,1.343,3,3v-1c0-1.657-1.343-3-3-3Z" fill="#fff" opacity=".2"></path>
            </svg>`,
  MXN: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <path fill="#fff" d="M10 4H22V28H10z"></path>
              <path d="M5,4h6V28H5c-2.208,0-4-1.792-4-4V8c0-2.208,1.792-4,4-4Z" fill="#2c6748"></path>
              <path d="M25,4h6V28h-6c-2.208,0-4-1.792-4-4V8c0-2.208,1.792-4,4-4Z" transform="rotate(180 26 16)" fill="#be2a2c"></path>
              <path d="M27,4H5c-2.209,0-4,1.791-4,4V24c0,2.209,1.791,4,4,4H27c2.209,0,4-1.791,4-4V8c0-2.209-1.791-4-4-4Zm3,20c0,1.654-1.346,3-3,3H5c-1.654,0-3-1.346-3-3V8c0-1.654,1.346-3,3-3H27c1.654,0,3,1.346,3,3V24Z" opacity=".15"></path>
              <path d="M27,5H5c-1.657,0-3,1.343-3,3v1c0-1.657,1.343-3,3-3H27c1.657,0,3,1.343,3,3v-1c0-1.657-1.343-3-3-3Z" fill="#fff" opacity=".2"></path>
              <path fill="#bb3433" d="M17.875 19.221L17.874 19.221 17.875 19.221 17.875 19.221z"></path>
              <path fill="#bb3433" d="M19.08 17.788L19.08 17.788 19.08 17.788 19.08 17.788z"></path>
              <path fill="#bb3433" d="M15.938 18.943L15.938 18.944 15.938 18.944 15.938 18.943z"></path>
              <path fill="#bb3433" d="M16.305 19.76L16.305 19.76 16.305 19.76 16.305 19.76z"></path>
              <path fill="#854a29" d="M16.196 16.434L16.196 16.434 16.196 16.434 16.196 16.434z"></path>
              <path d="M14.757,12.878h0s0,0,0,0Z" fill="#854a29"></path>
              <path fill="#854a29" d="M15.137 12.715L15.137 12.715 15.137 12.715 15.137 12.715z"></path>
              <path d="M18.701,18.611c-.462-.69-.74,.319-1.215,.252,.125-.81-.778-.5-1.196-.312l.165-.241c-.625,.291-1.368-.712-1.816,.028-.095-.205-.882-.689-1.201-.328,.025-1.017-1.723-.957-.807,.081,.63,.179,.975,.964,1.915,.554,.129,.53,1.025,.583,1.413,.297-.052,.161-.027,.622-.041,.715,.479,.384,.485-.223,.822-.414,.489-.25,2.275,.502,1.96-.631Z" fill="#3b8288"></path>
              <path d="M14.624,17.264s.004,.003,.012,.007c-.007-.004-.011-.007-.012-.007h0Z" fill="#a27037"></path>
              <path d="M18.215,13.019c.002-.497-3.62-1.554-2.526,.068-.258,.037-.691-.15-.712-.352,0,0,0,0,0,0,0,0,0,0,0,0,.015,.04-.11,.248-.151,.267-.006-.1-.03-.192-.03-.192v.004c-.125-.31-.028,.433-.249,.37,.076-.029,.006-.364-.052-.32,.037,.024-.047,.41-.121,.427,.045-.065-.042-.324-.062-.272,0,0,0,0,0,0,.063,.263-.45,.571-.376,.701-.336,.119-.481,.946,.12,.757-.256-.134-.135-.469,.172-.434-.014-.003,.043,.021,.027,.032,.079,.371,.485-.072,.645-.128-.169,.942-.602,1.836,.288,2.773-.295-.311-.349,.054-.016,.163-.201,.01-.431,.205-.085,.313-.071,.072-.345-.137-.195,.009-.003-.001-.006-.003-.009-.004,0,0,.002,.002,.006,.005-.572-.025-.025,.2,.214,.222-.194,.305,.482,.023,.548,.016,0,0,0,0,0,0,.133,.335,.238,.032,.208-.217,.095,.109,.19,.217,.287,.324h0s0,0,0,0h0c.152,.041,.318,.718,.432,.365,.004-.014,.006-.028,.008-.042,.226,.254,.334,.35,.235-.053,.123,.202,.233,.26,.201-.004,.186,.195,.137-.07,.118-.206,.179,.711,1.985,.561,1.799,.083-.312-.304-2.294-1.415-1.782-2.109,.194,.099,1.156,1.304,.738,.599-.371-.965,.316,0,.418,.358,.23,.415-.128-.724-.204-.764,.635,.793,.576,1.491,.375,.027,.025,.048,.066,.086,.116,.105-.037-.074-.08-.103-.104-.114,.039,.009,.087,.068,.107,.115-.001,0-.002,0-.003-.001,.339,1.803,.462,1.494,.249-.132,.512,2.02,.44,2.008,.384-.037,.367,.526,.103,1.624,.26,2.125,.274-.584,.176-2.301,.355-2.761-.337-.32-1.113-2.012-1.631-2.085Zm-2.889,4.239s0-.001,0-.002h.002s-.001,.001-.002,.002Z" fill="#a27037"></path>
              <path d="M14.715,16.587c.079-.641-.499-.553-.914-.554-.811-.68,1.523-1.254,.432-1.993h.004s-.008-.002-.007-.002l.007,.002s-.023-.023-.022-.023c-.094,.015-.235,.019-.282,.136,0,0,.003,.002,.006,.005l-.126,.148c0,.006,.21,.147,.201,.157,.008-.002,.019,.009,.025,.013,.11,.347-.585,.486-.724,.802-.445,.914,.373,1.211,1.023,1.217-.875,.946-.794,.138-1.382-.416,.083-.354,.237-.801-.251-.948,.003-.079-.13-.161-.165-.041,.033-.034-.086-.136-.135-.069-.19-.243-.413,.369-.078,.307,.008,.075,.133,.04,.152,.023-.003,.095,.142,.085,.161,.025,.33,.191-.146,.548,.001,.847,.195,.36,.548,.505,.559,.978,.29,.474,1.476-.153,1.506-.487,.005-.039,.007-.081,.01-.123h0Zm-.254-1.951s.004,.004,.005,.005h0s-.004-.003-.006-.005h0Zm-.572,.62s0,0,0,0c0,0,0,0,0,0h0Z" fill="#a9ac78"></path>
              <path d="M13.746,13.936c.005,.021-.459,.125-.392-.081,.088,.028,.498-.271,.332-.237-.458,.313-.307-.073-.156-.339,.045,.015,.052,.236,.028,.25,.133-.089,.077-.573-.109-.321-.182-.073-.67,.401-.397,.595-.096,.419,.233,.596,.585,.507l.002-.006h.031c-.052-.007,.077-.344,.076-.367Z" fill="#a9ac78"></path>
            </svg>`,
  USD: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <rect x="1" y="4" width="30" height="24" rx="4" ry="4" fill="#fff"></rect>
              <path d="M1.638,5.846H30.362c-.711-1.108-1.947-1.846-3.362-1.846H5c-1.414,0-2.65,.738-3.362,1.846Z" fill="#a62842"></path>
              <path d="M2.03,7.692c-.008,.103-.03,.202-.03,.308v1.539H31v-1.539c0-.105-.022-.204-.03-.308H2.03Z" fill="#a62842"></path>
              <path fill="#a62842" d="M2 11.385H31V13.231H2z"></path>
              <path fill="#a62842" d="M2 15.077H31V16.923000000000002H2z"></path>
              <path fill="#a62842" d="M1 18.769H31V20.615H1z"></path>
              <path d="M1,24c0,.105,.023,.204,.031,.308H30.969c.008-.103,.031-.202,.031-.308v-1.539H1v1.539Z" fill="#a62842"></path>
              <path d="M30.362,26.154H1.638c.711,1.108,1.947,1.846,3.362,1.846H27c1.414,0,2.65-.738,3.362-1.846Z" fill="#a62842"></path>
              <path d="M5,4h11v12.923H1V8c0-2.208,1.792-4,4-4Z" fill="#102d5e"></path>
              <path d="M27,4H5c-2.209,0-4,1.791-4,4V24c0,2.209,1.791,4,4,4H27c2.209,0,4-1.791,4-4V8c0-2.209-1.791-4-4-4Zm3,20c0,1.654-1.346,3-3,3H5c-1.654,0-3-1.346-3-3V8c0-1.654,1.346-3,3-3H27c1.654,0,3,1.346,3,3V24Z" opacity=".15"></path>
              <path d="M27,5H5c-1.657,0-3,1.343-3,3v1c0-1.657,1.343-3,3-3H27c1.657,0,3,1.343,3,3v-1c0-1.657-1.343-3-3-3Z" fill="#fff" opacity=".2"></path>
              <path fill="#fff" d="M4.601 7.463L5.193 7.033 4.462 7.033 4.236 6.338 4.01 7.033 3.279 7.033 3.87 7.463 3.644 8.158 4.236 7.729 4.827 8.158 4.601 7.463z"></path>
              <path fill="#fff" d="M7.58 7.463L8.172 7.033 7.441 7.033 7.215 6.338 6.989 7.033 6.258 7.033 6.849 7.463 6.623 8.158 7.215 7.729 7.806 8.158 7.58 7.463z"></path>
              <path fill="#fff" d="M10.56 7.463L11.151 7.033 10.42 7.033 10.194 6.338 9.968 7.033 9.237 7.033 9.828 7.463 9.603 8.158 10.194 7.729 10.785 8.158 10.56 7.463z"></path>
              <path fill="#fff" d="M6.066 9.283L6.658 8.854 5.927 8.854 5.701 8.158 5.475 8.854 4.744 8.854 5.335 9.283 5.109 9.979 5.701 9.549 6.292 9.979 6.066 9.283z"></path>
              <path fill="#fff" d="M9.046 9.283L9.637 8.854 8.906 8.854 8.68 8.158 8.454 8.854 7.723 8.854 8.314 9.283 8.089 9.979 8.68 9.549 9.271 9.979 9.046 9.283z"></path>
              <path fill="#fff" d="M12.025 9.283L12.616 8.854 11.885 8.854 11.659 8.158 11.433 8.854 10.702 8.854 11.294 9.283 11.068 9.979 11.659 9.549 12.251 9.979 12.025 9.283z"></path>
              <path fill="#fff" d="M6.066 12.924L6.658 12.494 5.927 12.494 5.701 11.799 5.475 12.494 4.744 12.494 5.335 12.924 5.109 13.619 5.701 13.19 6.292 13.619 6.066 12.924z"></path>
              <path fill="#fff" d="M9.046 12.924L9.637 12.494 8.906 12.494 8.68 11.799 8.454 12.494 7.723 12.494 8.314 12.924 8.089 13.619 8.68 13.19 9.271 13.619 9.046 12.924z"></path>
              <path fill="#fff" d="M12.025 12.924L12.616 12.494 11.885 12.494 11.659 11.799 11.433 12.494 10.702 12.494 11.294 12.924 11.068 13.619 11.659 13.19 12.251 13.619 12.025 12.924z"></path>
              <path fill="#fff" d="M13.539 7.463L14.13 7.033 13.399 7.033 13.173 6.338 12.947 7.033 12.216 7.033 12.808 7.463 12.582 8.158 13.173 7.729 13.765 8.158 13.539 7.463z"></path>
              <path fill="#fff" d="M4.601 11.104L5.193 10.674 4.462 10.674 4.236 9.979 4.01 10.674 3.279 10.674 3.87 11.104 3.644 11.799 4.236 11.369 4.827 11.799 4.601 11.104z"></path>
              <path fill="#fff" d="M7.58 11.104L8.172 10.674 7.441 10.674 7.215 9.979 6.989 10.674 6.258 10.674 6.849 11.104 6.623 11.799 7.215 11.369 7.806 11.799 7.58 11.104z"></path>
              <path fill="#fff" d="M10.56 11.104L11.151 10.674 10.42 10.674 10.194 9.979 9.968 10.674 9.237 10.674 9.828 11.104 9.603 11.799 10.194 11.369 10.785 11.799 10.56 11.104z"></path>
              <path fill="#fff" d="M13.539 11.104L14.13 10.674 13.399 10.674 13.173 9.979 12.947 10.674 12.216 10.674 12.808 11.104 12.582 11.799 13.173 11.369 13.765 11.799 13.539 11.104z"></path>
              <path fill="#fff" d="M4.601 14.744L5.193 14.315 4.462 14.315 4.236 13.619 4.01 14.315 3.279 14.315 3.87 14.744 3.644 15.44 4.236 15.01 4.827 15.44 4.601 14.744z"></path>
              <path fill="#fff" d="M7.58 14.744L8.172 14.315 7.441 14.315 7.215 13.619 6.989 14.315 6.258 14.315 6.849 14.744 6.623 15.44 7.215 15.01 7.806 15.44 7.58 14.744z"></path>
              <path fill="#fff" d="M10.56 14.744L11.151 14.315 10.42 14.315 10.194 13.619 9.968 14.315 9.237 14.315 9.828 14.744 9.603 15.44 10.194 15.01 10.785 15.44 10.56 14.744z"></path>
              <path fill="#fff" d="M13.539 14.744L14.13 14.315 13.399 14.315 13.173 13.619 12.947 14.315 12.216 14.315 12.808 14.744 12.582 15.44 13.173 15.01 13.765 15.44 13.539 14.744z"></path>
            </svg>`
}


export default function Configuracion() {
  const { session } = useSession()
  const { businessId, isOwner } = useBusiness()
  const { canAccessFeature, subscription, checkLimit, updatePlan } = useSubscription()
  const { availableCurrencies, businessCurrencies, toggleCurrency, setMainCurrency, loading: currencyLoading } = useCurrency()
  const { hasPermission, loading: loadingPermissions } = usePermissions()

  // Balances State (Dynamic)
  const [initialBalances, setInitialBalances] = useState({})
  const [currentBalances, setCurrentBalances] = useState({})
  const [savingBalance, setSavingBalance] = useState(false)
  const [loading, setLoading] = useState(true)

  // Team State
  const [members, setMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState(null)
  const [planConfirmOpen, setPlanConfirmOpen] = useState(false)
  const [targetPlanId, setTargetPlanId] = useState(null)

  const saveBalance = async () => {
    if (!businessId || !isOwner) return // Only owner can save balance for now
    setSavingBalance(true)
    try {
      // Prepare payload: [{ currency_code, initial_balance }]
      const payload = Object.entries(initialBalances).map(([code, amount]) => ({
        currency_code: code,
        initial_balance: amount
      }))

      const updatedConfig = await updateBalanceConfig(businessId, payload)

      if (updatedConfig) {
        toast.success('Balance inicial actualizado correctamente')
        // Refresh balances
        const balConfig = await getBalanceConfig(businessId)
        if (balConfig) {
          const newInit = {}
          const newCurr = {}
          balConfig.forEach(b => {
            newInit[b.currency_code] = b.initial_balance
            newCurr[b.currency_code] = b.current_balance
          })
          setInitialBalances(newInit)
          setCurrentBalances(newCurr)
        }
      }
    } catch (error) {
      console.error(error)
      toast.error('Error al actualizar balance')
    } finally {
      setSavingBalance(false)
    }
  }

  const fetchMembers = async () => {
    if (!businessId) return
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('owner_id', businessId)

    if (error) console.error('Error fetching members:', error)
    else setMembers(data || [])
  }

  const handleInvite = async () => {
    // Check limit
    const limit = subscription?.plan_id === 'premium' ? 5 : 0
    if (members.length >= limit) {
      toast.error('Has alcanzado el límite de socios para tu plan.')
      return
    }

    if (!inviteEmail) return

    setInviteLoading(true)
    try {
      // Create invitation in team_member table
      const { data, error } = await supabase
        .from('team_members')
        .insert({
          owner_id: businessId,
          member_email: inviteEmail,
          role: 'editor',
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        // Handle specific RLS permission error
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.error('RLS Permission error:', error)
          toast.error('Error de permisos al invitar socio. Contacta al administrador.', {
            description: 'Error: ' + error.message,
            duration: 5000
          })
          return
        }
        throw error
      }

      setMembers([...members, data])
      setInviteEmail('')
      toast.success(`Invitación enviada a ${inviteEmail}`)
    } catch (err) {
      console.error('Error inviting member:', err)
      toast.error('Error al invitar socio. Verifica que no esté ya invitado.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleDeleteMember = async (id) => {
    setPendingMemberId(id)
    setDeleteConfirmOpen(true)
  }

  const handlePlanChange = async (planId) => {
    if (planId === subscription?.plan_id) return
    if (!isOwner) {
      toast.error('Solo el propietario puede cambiar el plan')
      return
    }

    setTargetPlanId(planId)
    setPlanConfirmOpen(true)
  }

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      if (businessId) {
        const balConfig = await getBalanceConfig(businessId)
        if (mounted && balConfig) {
          const init = {}
          const curr = {}
          balConfig.forEach(b => {
            init[b.currency_code] = b.initial_balance
            curr[b.currency_code] = b.current_balance
          })
          setInitialBalances(init)
          setCurrentBalances(curr)
        }

        if (mounted && canAccessFeature('partners') && isOwner) {
          await fetchMembers()
        }
      }

      if (mounted) setLoading(false)
    }

    loadData()
    return () => { mounted = false }
  }, [businessId, subscription, isOwner]) // Re-fetch if subscription changes (e.g. upgraded to premium -> fetch members)

  if (!loadingPermissions && !hasPermission('config.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <Shield className="h-16 w-16 text-muted-foreground/50" />
        <h1 className="text-2xl font-bold">Acceso Restringido</h1>
        <p className="text-muted-foreground">No tienes permisos para ver la configuración del sistema.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="w-8 h-8 text-primary" />
        </div>
        Configuración
      </h1>

      <Tabs defaultValue={isOwner ? "billing" : "general"} className="w-full max-w-7xl">
        <TabsList className="grid w-full grid-cols-6">
          {isOwner && <TabsTrigger value="billing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Planes</TabsTrigger>}
          <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">General</TabsTrigger>
          <TabsTrigger value="currencies" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Monedas</TabsTrigger>
          {hasPermission('team.manage') && <TabsTrigger value="team" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Equipo</TabsTrigger>}
          {hasPermission('team.manage') && <TabsTrigger value="roles" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Roles</TabsTrigger>}
          {hasPermission('config.edit') && <TabsTrigger value="permissions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Permisos</TabsTrigger>}
        </TabsList>

        {isOwner && (
          <TabsContent value="billing" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Free Plan */}
              <Card className={`relative flex flex-col ${subscription?.plan_id === 'free' ? 'border-primary shadow-md' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    Plan Gratuito
                    {subscription?.plan_id === 'free' && <Badge>Actual</Badge>}
                  </CardTitle>
                  <CardDescription>Para empezar a organizar tu negocio</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="text-3xl font-bold">$0 <span className="text-sm font-normal text-muted-foreground">/ mes</span></div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> 40 Transacciones / mes</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> 40 Productos</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> 5 Áreas de Inventario</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> 1 Moneda Activa</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Reportes Básicos (Solo lectura)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Sin Socios</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={subscription?.plan_id === 'free'}
                    onClick={() => handlePlanChange('free')}
                  >
                    {subscription?.plan_id === 'free' ? 'Plan Actual' : 'Cambiar a Gratuito'}
                  </Button>
                </CardFooter>
              </Card>

              {/* Premium Plan */}
              <Card className={`relative flex flex-col border-yellow-400 ${subscription?.plan_id === 'premium' || subscription?.status === 'trial' ? 'bg-yellow-50/50 shadow-md' : ''}`}>
                {subscription?.status === 'trial' && (
                  <div className="absolute -top-3 right-4 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-sm">
                    Prueba Activa
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex justify-between items-center text-yellow-700">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 fill-yellow-500 text-yellow-600" />
                      Plan Premium
                    </div>
                    {(subscription?.plan_id === 'premium' || subscription?.status === 'trial') && <Badge className="bg-yellow-500 hover:bg-yellow-600">Actual</Badge>}
                  </CardTitle>
                  <CardDescription>Para negocios en crecimiento sin límites</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="text-3xl font-bold">$10 <span className="text-sm font-normal text-muted-foreground">/ mes</span></div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Transacciones Ilimitadas</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Productos Ilimitados</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Áreas Ilimitadas</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Múltiples Monedas</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Reportes Avanzados + Exportación</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Hasta 5 Socios</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-yellow-600" /> Logs de Auditoría</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  {subscription?.plan_id === 'premium' ? (
                    <Button className="w-full" variant="outline" disabled>
                      Plan Activo
                    </Button>
                  ) : (
                    <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white" onClick={() => handlePlanChange('premium')}>
                      Suscribirse a Premium
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        )}

        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Balance del Negocio</CardTitle>
              <CardDescription>Gestiona el balance inicial y visualiza el actual para tus monedas activas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Balance Inicial (Editable) */}
              <div className="space-y-4 border-b pb-6">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Balance Inicial (Manual)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {businessCurrencies.length === 0 && (
                    <div className="col-span-full text-muted-foreground text-sm italic">
                      No tienes monedas activas. Ve a la pestaña "Monedas" para configurar.
                    </div>
                  )}
                  {businessCurrencies.map(currency => (
                    <div key={currency.code} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span>{currency.flag_url}</span>
                        Inicial {currency.code}
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={initialBalances[currency.code] || ''}
                        onChange={(e) => setInitialBalances(prev => ({ ...prev, [currency.code]: e.target.value }))}
                        disabled={loading || savingBalance}
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
                {businessCurrencies.length > 0 && hasPermission('config.edit') && (
                  <Button onClick={saveBalance} disabled={savingBalance}>
                    {savingBalance ? 'Guardando...' : 'Actualizar Balance Inicial'}
                  </Button>
                )}
              </div>

              {/* Balance Actual (Read-only) */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Balance Actual (Calculado)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {businessCurrencies.map(currency => (
                    <div key={currency.code} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span>{currency.flag_url}</span>
                        Actual {currency.code}
                      </Label>
                      <Input
                        type="number"
                        value={currentBalances[currency.code] || 0}
                        disabled={true}
                        className="bg-muted"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  El balance actual se calcula automáticamente: Balance Inicial + Ingresos - Gastos.
                </p>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currencies" className="space-y-6 mt-6">
          {subscription?.plan_id !== 'premium' && (
            <Alert className="bg-blue-50 border-blue-200">
              <Coins className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Plan Gratuito: Límite de Monedas</AlertTitle>
              <AlertDescription className="text-blue-700">
                Las cuentas en el plan gratuito solo pueden tener <strong>una moneda activa</strong> a la vez. Actualiza a Premium para habilitar múltiples monedas.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Monedas del Negocio</CardTitle>
              <CardDescription>Selecciona las monedas que utilizarás en tus transacciones y productos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">País</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Símbolo</TableHead>
                      <TableHead className="text-center">Activa</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableCurrencies.map((currency) => {
                      const isActive = businessCurrencies.some(bc => bc.code === currency.code)
                      const isDefault = businessCurrencies.find(bc => bc.code === currency.code)?.is_default

                      return (
                        <TableRow key={currency.code}>
                          <TableCell className="text-2xl">
                            <div
                              className="h-6 w-6"
                              dangerouslySetInnerHTML={{ __html: FLAGS[currency.code] }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{currency.code}</TableCell>
                          <TableCell>{currency.name}</TableCell>
                          <TableCell>{currency.symbol}</TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) => toggleCurrency(currency.code, checked)}
                              disabled={isDefault || !hasPermission('config.edit')} // Cannot deactivate default currency
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {isActive && hasPermission('config.edit') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => !isDefault && setMainCurrency(currency.code)}
                                disabled={isDefault}
                                className={isDefault ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}
                                title={isDefault ? "Moneda Principal" : "Establecer como Principal"}
                              >
                                {isDefault ? <Star className="fill-yellow-500 h-5 w-5" /> : <StarOff className="h-5 w-5" />}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6 mt-6">
          {!canAccessFeature('partners') ? (
            <Alert className="bg-blue-50 border-blue-200">
              <Crown className="h-4 w-4 text-yellow-600 fill-yellow-400" />
              <AlertTitle className="text-blue-800">Función Premium</AlertTitle>
              <AlertDescription className="text-blue-700">
                Actualiza al plan Premium para agregar hasta 5 socios a tu equipo y gestionar permisos.
              </AlertDescription>
            </Alert>
          ) : (
            <TeamManagement />
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-6 mt-6">
          {!canAccessFeature('partners') ? (
            <Alert className="bg-blue-50 border-blue-200">
              <Crown className="h-4 w-4 text-yellow-600 fill-yellow-400" />
              <AlertTitle className="text-blue-800">Función Premium</AlertTitle>
              <AlertDescription className="text-blue-700">
                La gestión avanzada de roles y permisos es una característica Premium.
              </AlertDescription>
            </Alert>
          ) : (
            <RoleManagement />
          )}
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6 mt-6">
          {!canAccessFeature('partners') ? (
            <Alert className="bg-blue-50 border-blue-200">
              <Crown className="h-4 w-4 text-yellow-600 fill-yellow-400" />
              <AlertTitle className="text-blue-800">Función Premium</AlertTitle>
              <AlertDescription className="text-blue-700">
                La configuración y el sistema de permisos basado en roles son características exclusivas del plan Premium.
              </AlertDescription>
            </Alert>
          ) : (
            <PermissionSettings />
          )}
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => {
          setDeleteConfirmOpen(o)
          if (!o) setPendingMemberId(null)
        }}
        title="Confirmar eliminación de socio"
        description="¿Deseas eliminar este socio de tu equipo?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        tone="destructive"
        onConfirm={async () => {
          if (!pendingMemberId) return
          try {
            const { error } = await supabase
              .from('team_members')
              .delete()
              .eq('id', pendingMemberId)
              .eq('owner_id', businessId)
            if (error) throw error
            setMembers(members.filter(m => m.id !== pendingMemberId))
            toast.success('Socio eliminado correctamente')
          } catch (err) {
            console.error('Error deleting member:', err)
            toast.error('Error al eliminar socio')
          } finally {
            setDeleteConfirmOpen(false)
            setPendingMemberId(null)
          }
        }}
      />
      <ConfirmDialog
        open={planConfirmOpen}
        onOpenChange={(o) => {
          setPlanConfirmOpen(o)
          if (!o) setTargetPlanId(null)
        }}
        title={targetPlanId === 'premium' ? 'Confirmar actualización a Premium' : 'Confirmar cambio a Gratuito'}
        description={targetPlanId === 'premium' ? 'Se aplicarán funciones Premium en tu cuenta.' : 'Se aplicarán restricciones del plan Gratuito.'}
        confirmText="Confirmar"
        cancelText="Cancelar"
        onConfirm={async () => {
          if (!targetPlanId) return
          await updatePlan(targetPlanId)
          setPlanConfirmOpen(false)
          setTargetPlanId(null)
        }}
      />
    </div>
  )
}
