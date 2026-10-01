import { useAuth } from '@/features/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRole } from '@/hooks/useRole';
import { User, Shield, Mail, Key } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AuthApi } from '@/features/auth/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{10,}$/;

const EMPTY_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

type ChangePasswordError = {
  response?: { status?: number; data?: { message?: string } };
  status?: number;
  message?: string;
};

export function ProfilePage() {
  const { user } = useAuth();
  const { role } = useRole();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordDialogChange = (open: boolean) => {
    setPasswordDialogOpen(open);
    if (!open) {
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setPasswordError(null);
    }
  };

  const handlePasswordInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (passwordError) setPasswordError(null);
  };

  const validatePasswordForm = () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword) return 'La contraseña actual es requerida';
    if (newPassword.length < 10 || newPassword.length > 128) {
      return 'La nueva contraseña debe tener entre 10 y 128 caracteres';
    }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      return 'La nueva contraseña debe contener al menos una letra y un número';
    }
    if (newPassword !== confirmPassword) return 'Las contraseñas no coinciden';
    return null;
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validatePasswordForm();
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    setIsChangingPassword(true);
    try {
      await AuthApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Contraseña actualizada correctamente');
      handlePasswordDialogChange(false);
    } catch (err: unknown) {
      const changeError = err as ChangePasswordError;
      const message = changeError.response?.data?.message ?? changeError.message;
      setPasswordError(message || 'No se pudo cambiar la contraseña');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando información del usuario...</p>
        </div>
      </div>
    );
  }

  const getRoleInfo = (role: string) => {
    const roleMap: Record<string, { label: string; variant: "default" | "success" | "outline"; description: string; color: string }> = {
      ADMIN_FULL: { 
        label: 'Administrador General', 
        variant: 'success',
        description: 'Acceso completo a todas las funciones del sistema',
        color: 'bg-red-100 text-red-800'
      },
      ADMIN_CEREMONIAL: { 
        label: 'Administrador Ceremonial', 
        variant: 'default',
        description: 'Gestión de eventos ceremoniales, catálogos y aprobaciones ceremoniales',
        color: 'bg-blue-100 text-blue-800'
      },
      ADMIN_TECNICA: { 
        label: 'Administrador Técnica', 
        variant: 'default',
        description: 'Gestión de eventos técnicos, espacios y aprobaciones técnicas',
        color: 'bg-purple-100 text-purple-800'
      },
      USUARIO: { 
        label: 'Usuario', 
        variant: 'outline',
        description: 'Creación y gestión de eventos propios',
        color: 'bg-gray-100 text-gray-800'
      },
    };
    return roleMap[role] || { 
      label: role, 
      variant: 'outline' as const, 
      description: 'Usuario del sistema',
      color: 'bg-gray-100 text-gray-800'
    };
  };

  const roleInfo = getRoleInfo(role || '');

  const getPermissions = () => {
    const permissions: string[] = [];
    
    switch (role) {
      case 'ADMIN_FULL':
        permissions.push('Gestión completa del sistema');
        permissions.push('Administración de usuarios');
        permissions.push('Gestión de todos los eventos');
        permissions.push('Gestión de catálogos');
        permissions.push('Aprobaciones ceremoniales y técnicas');
        permissions.push('Acceso a auditoría e historial');
        break;
      case 'ADMIN_CEREMONIAL':
        permissions.push('Gestión de eventos ceremoniales');
        permissions.push('Aprobación de eventos ceremoniales');
        permissions.push('Gestión de espacios y departamentos');
        permissions.push('Visualización de historial');
        break;
      case 'ADMIN_TECNICA':
        permissions.push('Gestión de eventos técnicos');
        permissions.push('Aprobación de eventos técnicos');
        permissions.push('Gestión de espacios');
        permissions.push('Visualización de historial');
        break;
      case 'USUARIO':
        permissions.push('Creación de eventos propios');
        permissions.push('Edición de eventos propios');
        permissions.push('Visualización de eventos');
        permissions.push('Seguimiento de solicitudes');
        break;
    }
    
    return permissions;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground mt-1">Información de tu cuenta y permisos</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Información Personal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Usuario</label>
              <p className="text-lg font-semibold mt-1">{user.username}</p>
            </div>
            
            {user.email && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </label>
                <p className="text-sm mt-1">{user.email}</p>
              </div>
            )}

            {user.name && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nombre</label>
                <p className="text-sm mt-1">{user.name}</p>
              </div>
            )}
            
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Key className="h-3 w-3" />
                ID de Usuario
              </label>
              <p className="text-sm text-muted-foreground font-mono mt-1">{user.id}</p>
            </div>
          </CardContent>
        </Card>

        {/* Rol y Permisos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Rol y Permisos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">Rol Asignado</label>
              <div className="flex items-center gap-3">
                <Badge variant={roleInfo.variant} className="text-sm">
                  {roleInfo.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{roleInfo.description}</p>
            </div>
            
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Permisos
              </label>
              <ul className="space-y-1.5">
                {getPermissions().map((permission, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>{permission}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sección de Seguridad (opcional para futuras mejoras) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Seguridad</CardTitle>
          <CardDescription>
            Gestiona la seguridad de tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogChange}>
            <DialogTrigger asChild>
              <Button variant="outline">Cambiar Contraseña</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
                <DialogHeader>
                  <DialogTitle>Cambiar contraseña</DialogTitle>
                  <DialogDescription>
                    La nueva contraseña debe tener al menos 10 caracteres, con al menos una letra y un número.
                  </DialogDescription>
                </DialogHeader>

                {passwordError && (
                  <Alert variant="destructive">
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Contraseña actual</Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordInputChange}
                    disabled={isChangingPassword}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva contraseña</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    maxLength={128}
                    value={passwordForm.newPassword}
                    onChange={handlePasswordInputChange}
                    disabled={isChangingPassword}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    maxLength={128}
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordInputChange}
                    disabled={isChangingPassword}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePasswordDialogChange(false)}
                    disabled={isChangingPassword}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? 'Guardando...' : 'Guardar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
