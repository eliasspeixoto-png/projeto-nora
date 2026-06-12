
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Notebook, Save, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DialogClose, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addNote, deleteNote, getNotes } from '@/lib/firebase/firestore';
import type { Note } from '@/lib/data';
import { useAuth } from '@/firebase/auth/use-user';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent } from '@/components/ui/alert-dialog';


const formatDate = (dateString: string) => {
    try {
        return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
        return "Data inválida";
    }
}

export default function BlocoDeNotasPage() {
    const { userProfile, firebase } = useAuth();
    const { toast } = useToast();
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isAlertOpen, setAlertOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (!userProfile?.companyId || !firebase.db) {
            setIsLoading(false);
            return;
        }

        const unsub = getNotes(
            firebase.db,
            userProfile.companyId,
            userProfile.uid,
            (data) => {
                setNotes(data);
                setIsLoading(false);
            },
            (error) => {
                toast({ variant: 'destructive', title: 'Erro ao carregar notas', description: error.message });
                setIsLoading(false);
            }
        );

        return () => unsub();
    }, [userProfile?.companyId, userProfile?.uid, firebase.db, toast]);


    const handleSaveNote = async () => {
        if (!newNote.trim() || !userProfile || !firebase.db) {
            toast({
                variant: 'destructive',
                title: "Nota vazia",
                description: "Por favor, escreva algo antes de salvar.",
            });
            return;
        }

        setIsSaving(true);
        try {
            await addNote(firebase.db, {
                companyId: userProfile.companyId,
                userId: userProfile.uid,
                userName: userProfile.displayName,
                content: newNote.trim(),
            });
            setNewNote('');
            toast({
                title: "Nota Salva!",
                description: "Sua anotação foi salva no banco de dados.",
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Erro ao Salvar",
                description: error.message,
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const confirmDelete = (noteId: string) => {
        setNoteToDelete(noteId);
        setAlertOpen(true);
    };


    const handleDeleteNote = async () => {
        if (!noteToDelete || !firebase.db) return;
        try {
            await deleteNote(firebase.db, noteToDelete);
            toast({
                variant: 'destructive',
                title: "Nota Excluída!",
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Erro ao Excluir",
                description: error.message,
            });
        } finally {
            setAlertOpen(false);
            setNoteToDelete(null);
        }
    };

    return (
        <>
            <Card className="flex-1 flex flex-col h-full w-full">
                <CardHeader>
                    <div className="flex justify-between items-center">
                         <h2 className="font-semibold leading-none tracking-tight flex items-center gap-2 text-xl" role="heading" aria-level={2}>
                            <Notebook /> Bloco de Notas
                        </h2>
                         <DialogClose asChild>
                            <Button variant="ghost" size="icon">
                                <X className="h-5 w-5" />
                                <span className="sr-only">Fechar</span>
                            </Button>
                        </DialogClose>
                    </div>
                    <CardDescription>
                        Suas anotações rápidas, salvas e sincronizadas na nuvem.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                    <div className="space-y-2">
                        <Textarea
                            placeholder="Digite uma nova anotação aqui..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            className="w-full resize-none text-sm"
                            rows={4}
                        />
                        <Button onClick={handleSaveNote} size="sm" className="w-full" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Nova Anotação
                        </Button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full rounded-md border p-2">
                             {isLoading ? (
                                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando notas...
                                </div>
                             ) : notes.length > 0 ? (
                                <div className="space-y-3">
                                    {notes.map(note => (
                                        <div key={note.id} className="bg-muted/50 p-3 rounded-md relative group">
                                            <p className="text-xs text-muted-foreground mb-1">{formatDate(note.createdAt)} por {note.userName}</p>
                                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => confirmDelete(note.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                    Nenhuma anotação ainda.
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
            <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitleComponent>Você tem certeza?</AlertDialogTitleComponent>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A anotação será excluída permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteNote} className="bg-destructive hover:bg-destructive/90">
                            Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
