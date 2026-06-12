
"use client";

import { Company, Client } from "@/lib/data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Image from "next/image";

type NfsePreviewProps = {
    company: Company;
    client: Client;
    serviceDescription: string;
    serviceValue: number;
    serviceListCode?: string;
    cnaeCode?: string;
    codTributarioMunicipio?: string;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(amount);
};

const Field = ({ label, value }: { label: string; value?: string | number | null; }) => (
    <div>
        <p className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-semibold truncate">{value || '---'}</p>
    </div>
);

export default function NfsePreview({
    company,
    client,
    serviceDescription,
    serviceValue,
    serviceListCode,
    cnaeCode,
    codTributarioMunicipio,
}: NfsePreviewProps) {
    
    return (
        <div className="relative border bg-white text-black p-4 rounded-lg shadow-md max-w-2xl mx-auto font-sans overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <div 
                  className="text-8xl font-semibold text-gray-200 opacity-50 transform -rotate-45"
                  style={{ letterSpacing: '0.2em' }}
                >
                  RASCUNHO
                </div>
            </div>
            
            <div className="relative z-10">
                {/* Header */}
                <div className="text-center mb-4 border-b pb-2">
                    <div className="flex justify-center items-center gap-4">
                        <Image src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Bras%C3%A3o_de_Aracaju.svg/1200px-Bras%C3%A3o_de_Aracaju.svg.png" alt="Brasão" width={48} height={48} className="h-12 w-12" />
                        <div>
                            <h1 className="text-base font-semibold">NFS-e - Nota Fiscal de Serviços Eletrônica</h1>
                            <p className="text-xs">Município de {company.city || "Aracaju"}</p>
                        </div>
                    </div>
                </div>

                {/* Sections */}
                <div className="grid grid-cols-[2.5fr_1fr] gap-2">
                    {/* Main Content */}
                    <div className="space-y-2">
                        {/* Prestador */}
                        <div className="border p-2 rounded">
                            <h2 className="text-[9px] font-semibold bg-gray-100 -m-2 mb-2 p-1 px-2 rounded-t tracking-wider">Dados do Prestador</h2>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="col-span-2"><Field label="Razão Social / Nome" value={company.name} /></div>
                                <Field label="CPF/CNPJ" value={company.cnpj} />
                                <Field label="Telefone" value={company.phone} />
                                <Field label="Inscrição Municipal" value={company.inscricao_municipal} />
                                <Field label="Email" value={company.email} />
                                <div className="col-span-2">
                                    <Field label="Endereço" value={`${company.street || ''}, ${company.number || ''} - ${company.city || ''}/${company.state || ''}`} />
                                </div>
                            </div>
                        </div>
                        {/* Tomador */}
                        <div className="border p-2 rounded">
                            <h2 className="text-[9px] font-semibold bg-gray-100 -m-2 mb-2 p-1 px-2 rounded-t tracking-wider">Dados do Tomador</h2>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="col-span-2"><Field label="Razão Social / Nome" value={client.name} /></div>
                                <Field label="CPF/CNPJ" value={client.document} />
                                <Field label="Email" value={client.email} />
                                <div className="col-span-2">
                                    <Field label="Endereço" value={`${client.street || ''}, ${client.number || ''}, ${client.neighborhood || ''} - ${client.city || ''}/${client.state || ''}`} />
                                </div>
                            </div>
                        </div>
                        {/* Discriminação */}
                        <div className="border p-2 rounded">
                            <h2 className="text-[9px] font-semibold bg-gray-100 -m-2 mb-2 p-1 px-2 rounded-t tracking-wider">Discriminação dos Serviços</h2>
                            <p className="text-xs whitespace-pre-wrap">{serviceDescription}</p>
                        </div>
                    </div>
                    {/* Sidebar */}
                    <div className="border p-2 rounded space-y-2">
                        <div className="text-center">
                            <p className="text-xs font-semibold">NFS-e</p>
                            <p className="text-[8px]">Nº: (a ser gerado)</p>
                            <p className="text-[8px]">Cód. Verificação: (a ser gerado)</p>
                            <p className="text-[8px] mt-1">Data Emissão: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                            <div className="flex justify-center mt-2">
                            <div className="w-20 h-20 bg-gray-200 flex items-center justify-center text-[10px] text-gray-500 p-1">
                                QR Code
                            </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Values */}
                <div className="border p-2 rounded mt-2">
                    <div className="grid grid-cols-4 gap-x-4 gap-y-2">
                        <Field label="Valor dos Serviços" value={formatCurrency(serviceValue)} />
                        <Field label="Alíquota" value={`${(company.aliq_pis || 5.00).toFixed(2)}%`} />
                        <Field label="Valor do ISS" value={formatCurrency(serviceValue * ((company.aliq_pis || 5.00) / 100))} />
                        <Field label="Valor Total da Nota" value={formatCurrency(serviceValue)} />
                        <Field label="Cód. Serviço (LC 116)" value={serviceListCode} />
                        <Field label="Cód. Tribut. Município" value={codTributarioMunicipio} />
                        <Field label="CNAE" value={cnaeCode} />
                    </div>
                </div>
                <p className="text-[8px] text-center text-gray-400 mt-2">Documento auxiliar da Nota Fiscal de Serviço Eletrônica</p>
            </div>
        </div>
    );
}
