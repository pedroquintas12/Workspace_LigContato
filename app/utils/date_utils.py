def formatar_data(data):
    if data:
        return data.strftime("%d/%m/%Y %H:%M:%S")
    return None